import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate, authorize } from "../../middlewares/auth";
import App from "../../core/App";

export default class NewsDeleteRoute extends AppRoutes {
  constructor(app: App) {
    super(app, { route: "/api/news/:id", method: "delete", middlewares: [authenticate, authorize("admin")] });
  }

  async handle(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return error(res, "Neispravan ID", 400);

    try {
      const sel = await this.app.hkstExports.select(["vijesti"], `id=${id} LIMIT 1`);
      const row = (sel?.vijesti as any[])?.[0];
      if (!row) return error(res, "Vijest nije pronađena", 404);

      const delRes = await this.app.hkstWeb.delete("vijesti", `id=${id}`);
      if (delRes?.error) return error(res, "Greška pri brisanju vijesti", 500, delRes.error);

      return success(res, "Vijest obrisana", 200, { id, ...row });
    } catch (e: any) {
      return error(res, "Greška pri brisanju vijesti", 500, e?.message ?? e);
    }
  }
}
