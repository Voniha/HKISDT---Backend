import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate } from "../../middlewares/auth";
import App from "../../core/App";

export default class UsersDeleteRoute extends AppRoutes {
  constructor(app: App) {
    super(app, {
      route: "/api/users",
      method: "delete",
      middlewares: [authenticate],
    });
  }

  async handle(req: Request, res: Response) {
    const id = Number(req.query.id);
    if (!Number.isFinite(id) || id <= 0) return error(res, "Neispravan ID", 400);

    try {
      const existing = await this.app.db.select(["bod_clan"], `id=${id} LIMIT 1`);
      const row = (existing?.bod_clan as any[])?.[0];
      if (!row) return error(res, "Korisnik nije pronađen", 404);

      const { data: delData, error: delErr } =
        (await this.app.db.delete?.("bod_clan", `id=${id}`)) ?? { data: null, error: null };

      if (delErr) return error(res, "Greška pri brisanju", 500, delErr);
      

      return success(res, "Korisnik obrisan", 200, { id });
    } catch (e: any) {
      return error(res, "Greška pri brisanju korisnika", 500, e?.message ?? e);
    }
  }
}
