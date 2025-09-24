import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { error } from "../../utils/responses";
import App from "../../core/App";
import Dokumenti from "../../types/Database/tables/HKST_WEB/dokumenti";

export default class DownloadDocumentRoute extends AppRoutes {
  constructor(app: App) {
    super(app, { route: "/api/documents/:id/download", method: "get", middlewares: [] });
  }

  async handle(req: Request, res: Response) {
    try {
      const id = Number(req.params.id || 0) || null;
      const blockId = req.query.blockId ? Number(req.query.blockId) || null : null;
      let documentId = id;
      let externalUrl: string | null = null;

      if (!documentId && !blockId) return error(res, "Obavezno document id ili blockId", 400);

      if (!documentId && blockId) {
        const sel = await this.app.hkstExports.select(["blokovi_sadrzaja"], `id=${blockId} LIMIT 1`);
        const block = (sel?.blokovi_sadrzaja as any[])?.[0] ?? null;
        if (!block) return error(res, "Blok nije pronađen", 404);
        if (block.dokument_id) documentId = Number(block.dokument_id);
        else if (block.url) externalUrl = String(block.url);
        else return error(res, "Blok nema ni dokument ni eksterni URL", 404);
      }

      if (externalUrl) return res.redirect(302, externalUrl);

      const rows = await this.app.hkstWeb.query(
        "SELECT id, datoteka_blob, naziv_datoteke, mime_tip, velicina_bajtova FROM `dokumenti` WHERE id = ? LIMIT 1",
        [documentId]
      );
      const doc: any = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (!doc) return error(res, "Dokument nije pronađen", 404);

      let buf: Buffer | null = null;
      const raw = doc.datoteka_blob;

      if (Buffer.isBuffer(raw)) buf = raw;
      else if (raw instanceof ArrayBuffer) buf = Buffer.from(raw);
      else if (Array.isArray(raw) && raw.every((n: any) => typeof n === "number")) buf = Buffer.from(raw as number[]);
      else if (typeof raw === "string") {
        try {
          const j = JSON.parse(raw);
          if (j?.type === "Buffer" && Array.isArray(j.data)) buf = Buffer.from(j.data);
          else if (typeof j?.data === "string") {
            const b64 = Buffer.from(j.data, "base64");
            buf = b64.length ? b64 : Buffer.from(j.data, "utf8");
          } else {
            const b64 = Buffer.from(raw, "base64");
            buf = b64.length ? b64 : Buffer.from(raw, "utf8");
          }
        } catch {
          const b64 = Buffer.from(raw, "base64");
          buf = b64.length ? b64 : Buffer.from(raw, "utf8");
        }
      }

      if (!buf || !buf.length) return error(res, "Dokument nema sadržaj", 404);

      const sizeMeta = Number(doc.velicina_bajtova || 0);
      const payload = sizeMeta > 0 && buf.length >= sizeMeta ? buf.subarray(0, sizeMeta) : buf;

      const name = doc.naziv_datoteke || `document-${doc.id}`;
      const mime = doc.mime_tip || "application/pdf";

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
      res.setHeader("Content-Encoding", "identity");
      res.setHeader("Accept-Ranges", "none");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Length", String(payload.length));
      res.end(payload);
    } catch (e: any) {
      return error(res, "Greška pri preuzimanju dokumenta", 500, e?.message ?? e);
    }
  }
}
