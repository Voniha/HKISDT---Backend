import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate, authorize } from "../../middlewares/auth";
import App from "../../core/App";
import multer from "multer";
import crypto from "crypto";
import Stranice from "../../types/Database/tables/HKST_WEB/stranice";
import Dokumenti from "../../types/Database/tables/HKST_WEB/dokumenti";
import { BlokoviSadrzaja } from "../../types/Database/tables/HKST_WEB/sadrzaj_blokova";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

type BatchItem = {
  type?: string;
  content?: string;
  label?: string;
  fileKey?: string;
  url?: string;
  position?: number;
  originalName?: string;
};

export default class DocumentBatchCreateRoute extends AppRoutes {
  constructor(app: App) {
    super(app, {
      route: "/api/documents/batch",
      method: "post",
      middlewares: [upload.any()],
    });
  }

  async handle(req: Request, res: Response) {
    try {
      const body = (req.body ?? {}) as Record<string, any>;
      const files = (req as any).files as Express.Multer.File[] | undefined;

      let pageId: number | null = null;
      if (body.pageId) pageId = Number(body.pageId) || null;
      else if (body.pageSlug && typeof body.pageSlug === "string") {
        const slug = body.pageSlug.trim();
        const sel = await this.app.hkstExports.select(["stranice"], `slug='${slug}' LIMIT 1`);
        const pageRow = (sel?.stranice as Stranice[])?.[0] ?? null;
        pageId = pageRow?.id ?? null;
      }
      if (!pageId) return error(res, "Morate navesti pageId ili pageSlug postojeće stranice", 400);

      let items: BatchItem[] = [];
      if (body.items) {
        try {
          const parsed = typeof body.items === "string" ? JSON.parse(body.items) : body.items;
          items = Array.isArray(parsed) ? parsed : [];
        } catch {
          return error(res, "Polje 'items' nije valjani JSON niz", 400);
        }
      } else if (files && files.length) {
        items = files.map((f, i) => ({ type: "dokument", label: f.originalname, fileKey: f.fieldname, position: i + 1 }));
      }

      const fileMap = new Map<string, Express.Multer.File>();
      if (files && files.length) {
        for (const f of files) {
          fileMap.set(f.fieldname, f);
          fileMap.set(f.originalname, f);
        }
      }

      const shaCache = new Map<string, number>();
      const createdBlocks: Array<Partial<BlokoviSadrzaja> & { position?: number }> = [];
      const createdDocuments: Record<string, number> = {};

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = String(item.type || "").toLowerCase();
        const position = item.position ? Number(item.position) : 0;

        if (type === "dokument" || type === "slika") {
          const fk = item.fileKey;
          const file = fk ? fileMap.get(fk) : fileMap.get(item.originalName ?? item.label ?? "");
          if (!file) {
            if (item.url && typeof item.url === "string") {
              const blockObj: Partial<BlokoviSadrzaja> = {
                stranica_id: pageId,
                vrsta: (type === "slika" ? "slika" : "dokument") as BlokoviSadrzaja["vrsta"],
                sadrzaj: item.label ?? null,
                url: item.url,
                pozicija: position,
              } as any;
              const { data: blkData, error: blkErr } = await this.app.hkstWeb.insert("blokovi_sadrzaja", blockObj);
              if (blkErr) throw blkErr;
              const bid = Number((blkData?.insertId ?? blkData?.insertID) || 0);
              createdBlocks.push({ id: bid, vrsta: blockObj.vrsta, url: item.url, position });
            }
            continue;
          }

          const buffer = file.buffer;
          const sha = crypto.createHash("sha256").update(buffer).digest("hex");
          if (!shaCache.has(sha)) {
            const existing = await this.app.hkstExports.select(["dokumenti"], `sha256='${sha}' LIMIT 1`);
            const existingRow = (existing?.dokumenti as Dokumenti[])?.[0];
            if (existingRow?.id) {
              shaCache.set(sha, existingRow.id);
            } else {
              const insertObj: Partial<Dokumenti> = {
                datoteka_blob: buffer as any,
                naziv_datoteke: file.originalname || "file",
                mime_tip: file.mimetype || "application/octet-stream",
                velicina_bajtova: file.size || buffer.length,
                sha256: sha,
              };
              const { data: insData, error: insErr } = await this.app.hkstWeb.insert("dokumenti", insertObj);
              if (insErr) throw insErr;
              const docId = Number((insData?.insertId ?? insData?.insertID) || 0);
              if (!docId) throw new Error("Nije moguće dobiti ID ubacenog dokumenta");
              shaCache.set(sha, docId);
            }
          }
          const docId = shaCache.get(sha)!;
          createdDocuments[file.originalname] = docId;

          const blockObj: Partial<BlokoviSadrzaja> = {
            stranica_id: pageId,
            vrsta: (type === "slika" ? "slika" : "dokument") as BlokoviSadrzaja["vrsta"],
            sadrzaj: item.label ?? file.originalname,
            dokument_id: docId,
            pozicija: position,
          } as any;
          const { data: blkData, error: blkErr } = await this.app.hkstWeb.insert("blokovi_sadrzaja", blockObj);
          if (blkErr) throw blkErr;
          const bid = Number((blkData?.insertId ?? blkData?.insertID) || 0);
          createdBlocks.push({ id: bid, vrsta: blockObj.vrsta, dokument_id: docId, sadrzaj: blockObj.sadrzaj ?? null, position });
          continue;
        }

        if (type === "naslov" || type === "podnaslov" || type === "tekst") {
          const blockObj: Partial<BlokoviSadrzaja> = {
            stranica_id: pageId,
            vrsta: type as BlokoviSadrzaja["vrsta"],
            sadrzaj: item.content ?? item.label ?? null,
            pozicija: position,
          } as any;
          const { data: blkData, error: blkErr } = await this.app.hkstWeb.insert("blokovi_sadrzaja", blockObj);
          if (blkErr) throw blkErr;
          const bid = Number((blkData?.insertId ?? blkData?.insertID) || 0);
          createdBlocks.push({ id: bid, vrsta: blockObj.vrsta, sadrzaj: blockObj.sadrzaj ?? null, position });
        }
      }

      return success(res, "Stavke uspješno dodane", 201, { pageId, createdDocuments, createdBlocks });
    } catch (e: any) {
      console.error("DocumentBatchCreateRoute error:", e);
      return error(res, "Greška pri dodavanju stavki", 500, e?.message ?? e);
    }
  }
}
