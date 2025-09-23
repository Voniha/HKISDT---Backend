import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate, authorize } from "../../middlewares/auth";
import App from "../../core/App";

export default class UsersDeleteRoute extends AppRoutes {
  constructor(app: App) {
    super(app, {
      route: "/api/users/:id",
      method: "delete",
      middlewares: [authenticate, authorize("admin")],
    });
  }

  async handle(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return error(res, "Neispravan ID", 400);

    try {
      const sel = await this.app.hkstExports.select(["bod_clan"], `id=${id} LIMIT 1`);
      const row = (sel?.bod_clan as any[])?.[0];
      if (!row) return error(res, "Korisnik nije pronađen", 404);

      const delResult = await this.app.hkstExports.delete("bod_clan", `id=${id}`);
      if (delResult?.error) return error(res, "Greška pri brisanju korisnika", 500, delResult.error);

      return success(res, "Korisnik obrisan", 200, {
        id,
        ...row
      });
    } catch (e: any) {
      return error(res, "Greška pri brisanju korisnika", 500, e?.message ?? e);
    }
  }
}
