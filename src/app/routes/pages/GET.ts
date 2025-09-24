import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { error } from "../../utils/responses";
import App from "../../core/App";
import Dokumenti from "../../types/Database/tables/HKST_WEB/dokumenti";

export default class DownloadDocumentRoute extends AppRoutes {
  constructor(app: App) {
    super(app, {
      route: "/api/documents/:id/download",
      method: "get",
      middlewares: [],
    });
  }

  async handle(req: Request, res: Response) {
    try {
      const routeId = req.params.id ? Number(req.params.id) || null : null;
      const q = req.query ?? {};
      const blockId = q.blockId ? Number(q.blockId) || null : null;

      let documentId: number | null = routeId;
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
      const docRow: Dokumenti | null = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
      if (!docRow) return error(res, "Dokument nije pronađen", 404);

      const raw = (docRow as any).datoteka_blob;
      if (!raw) return error(res, "Dokument nema sadržaj", 404);

      let buffer: Buffer;

      if (Buffer.isBuffer(raw)) {
        let b = raw;
        if (b.length && b[0] === 0x7b) {
          try {
            const j = JSON.parse(b.toString("utf8"));
            if (j && j.type === "Buffer" && Array.isArray(j.data)) b = Buffer.from(j.data);
            else if (j && typeof j.data === "string") {
              const bx = Buffer.from(j.data, "base64");
              b = bx.length ? bx : Buffer.from(j.data, "utf8");
            }
          } catch {}
        }
        buffer = b;
      } else if (typeof raw === "string") {
        try {
          const j = JSON.parse(raw);
          if (j && j.type === "Buffer" && Array.isArray(j.data)) buffer = Buffer.from(j.data);
          else if (j && typeof j.data === "string") {
            const bx = Buffer.from(j.data, "base64");
            buffer = bx.length ? bx : Buffer.from(j.data, "utf8");
          } else {
            const b64 = Buffer.from(raw, "base64");
            buffer = b64.length ? b64 : Buffer.from(raw, "utf8");
          }
        } catch {
          const b64 = Buffer.from(raw, "base64");
          buffer = b64.length ? b64 : Buffer.from(raw, "utf8");
        }
      } else if (raw instanceof ArrayBuffer) {
        buffer = Buffer.from(raw);
      } else if (Array.isArray(raw) && raw.every(n => typeof n === "number")) {
        buffer = Buffer.from(raw as number[]);
      } else {
        buffer = Buffer.from(String(raw), "utf8");
      }

      const meta = Number(docRow.velicina_bajtova || 0);
      const payload = meta > 0 && buffer.length >= meta ? buffer.subarray(0, meta) : buffer;

      const fileName = docRow.naziv_datoteke || `document-${docRow.id}`;
      const mime = docRow.mime_tip || "application/octet-stream";

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader("Content-Encoding", "identity");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Accept-Ranges", "none");
      res.setHeader("Content-Length", String(payload.length));
      res.end(payload);
      return;
    } catch (e: any) {
      return error(res, "Greška pri preuzimanju dokumenta", 500, e?.message ?? e);
    }
  }
}
