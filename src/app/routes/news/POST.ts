import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate, authorize } from "../../middlewares/auth";
import App from "../../core/App";
import { trimMax, isDateYYYYMMDD, slugify } from "../../utils/helpers";
import { getTableColumns } from "../../utils/columns";

export default class NewsCreateRoute extends AppRoutes {
  constructor(app: App) {
    super(app, {
      route: "/api/news",
      method: "post",
      middlewares: [authenticate, authorize("admin")],
    });
  }

  async handle(req: Request, res: Response) {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!body.title || typeof body.title !== "string" || !body.title.trim()) return error(res, "Naslov je obavezan", 400);

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

        if (typeof v === "boolean") {
          candidate[k] = v ? 1 : 0;
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
          candidate[k] = trimMax(s, 65535) ?? s;
          continue;
        }

        try {
          candidate[k] = JSON.stringify(v);
        } catch {
        }
      }

      if (!candidate.alias && candidate.title) candidate.alias = slugify(String(candidate.title));

      const toInsert: Record<string, any> = {};
      for (const [k, v] of Object.entries(candidate)) if (allowed.has(k)) toInsert[k] = v;

      if (!Object.keys(toInsert).length) return error(res, "Nijedno polje za unos nije validno", 400);

      const { data, error: dbErr } = await this.app.hkstWeb.insert("vijesti", toInsert);
      if (dbErr) return error(res, "Greška pri kreiranju vijesti", 500, dbErr);

      const insertId = Number((data?.insertId ?? data?.insertID) || 0);
      if (!insertId) return error(res, "Greška pri kreiranju vijesti", 500, "Nije moguće dobiti ID unosa");

      const sel = await this.app.hkstExports.select(["vijesti"], `id=${insertId} LIMIT 1`);
      const item = (sel?.vijesti as any[])?.[0] ?? null;

      return success(res, "Vijest kreirana", 201, { id: insertId, item });
    } catch (e: any) {
      return error(res, "Greška pri kreiranju vijesti", 500, e?.message ?? e);
    }
  }
}
