import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate, authorize } from "../../middlewares/auth";
import App from "../../core/App";
import { trimMax, isDateYYYYMMDD } from "../../utils/helpers";
import { getTableColumns } from "../../utils/columns";
import VijestiRow from "../../types/Database/tables/HKST_EXPORTS/vijesti";

export default class NewsUpdateRoute extends AppRoutes {
  constructor(app: App) {
    super(app, { route: "/api/news/:id", method: "patch", middlewares: [authenticate, authorize("admin")] });
  }

  async handle(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return error(res, "Neispravan ID", 400);

    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!Object.keys(body).length) return error(res, "Nema polja za ažuriranje", 400);

    try {
      const allowed = await getTableColumns(this.app, "vijesti");
      const candidate: Record<string, any> = {};

      for (const [k, v] of Object.entries(body)) {
        if (!allowed.has(k) || k === "id") continue;
        if (v === undefined) continue;
        if (v === null) {
          candidate[k] = null;
          continue;
        }

        if (typeof v === "number") {
          candidate[k] = v;
          continue;
        }

        if (typeof v === "string") {
          const s = v.trim();
          const dateLike = /(?:date|time|publish|created|modified)/i.test(k);
          if (dateLike) {
            const dtRe = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/;
            if (isDateYYYYMMDD(s) || dtRe.test(s)) {
              candidate[k] = s;
            }
            continue;
          }

          if (/^\d+$/.test(s)) {
            const n = Number(s);
            if (Number.isFinite(n)) {
              candidate[k] = n;
              continue;
            }
          }

          candidate[k] = trimMax(s, 65535) ?? s;
          continue;
        }

        if (typeof v === "boolean") {
          candidate[k] = v ? 1 : 0;
          continue;
        }

        try {
          candidate[k] = JSON.stringify(v);
        } catch {}
      }

      if (!Object.keys(candidate).length) return error(res, "Nema valjanih polja za ažuriranje", 400);

      const { error: updErr } = await this.app.hkstWeb.update("vijesti", `id=${id}`, candidate as VijestiRow);
      if (updErr) return error(res, "Greška pri ažuriranju vijesti", 500, updErr);

      const sel = await this.app.hkstExports.select(["vijesti"], `id=${id} LIMIT 1`);
      const item = (sel?.vijesti as any[])?.[0] ?? null;
      if (!item) return error(res, "Vijest nije pronađena nakon ažuriranja", 404);

      return success(res, "Vijest ažurirana", 200, { item });
    } catch (e: any) {
      return error(res, "Greška pri ažuriranju vijesti", 500, e?.message ?? e);
    }
  }
}
