import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import App from "../../core/App";
import { trimMax, esc, q } from "../../utils/helpers";
import ReqBody from "../../types/App/authTypes";
import AdminsRow from "../../types/Database/tables/HKST_WEB/admins";
import { authenticate, authorize } from "../../middlewares/auth";

export default class AuthRegisterRoute extends AppRoutes {
  constructor(app: App) {
    super(app, {
      route: "/api/auth/register",
      method: "post",
      middlewares: [authenticate, authorize("admin")],
    });
  }

  public async handle(req: Request<any, any, ReqBody>, res: Response) {
    const logger = (this.app as any)?.logger ?? console;
    const { ime, prezime, jmbg } = req.body ?? {};

    const prepared = {
      ime: trimMax(ime, 32),
      prezime: trimMax(prezime, 32),
      jmbg: trimMax(jmbg, 14),
    };

    if (!prepared.jmbg) return error(res, "Za admin registraciju obavezan je jmbg", 400);

    try {
      const where = `jmbg=${q(prepared.jmbg) || `'${esc(prepared.jmbg)}'`} LIMIT 1`;
      const existing = await this.app.hkstWeb.select(["admins"], where);
      const admins = (existing?.admins as AdminsRow[]) ?? [];
      if (admins.length) return error(res, "Admin s tim JMBG-om već postoji", 409);

      const toInsert: Record<string, any> = { jmbg: prepared.jmbg };
      if (prepared.ime) toInsert.ime = prepared.ime;
      if (prepared.prezime) toInsert.prezime = prepared.prezime;

      const { data, error: dbErr } = await this.app.hkstWeb.insert("admins", toInsert);
      if (dbErr) return error(res, "Greška pri registraciji novoga admina", 500, dbErr);

      const insertId = Number((data?.insertId ?? data?.insertID) || 0);
      if (!insertId) {
        logger.error?.("AuthRegisterRoute: missing insertId", { data });
        return error(res, "Greška pri registraciji novoga admina", 500, "Nije moguće dobiti ID novog admina");
      }

      const sel = await this.app.hkstWeb.select(["admins"], `id=${insertId} LIMIT 1`);
      const newAdmin = (sel?.admins as AdminsRow[])?.[0] ?? null;

      return success(res, "Registracija novoga admina uspješna", 201, {
        id: insertId,
        jmbg: newAdmin?.jmbg ?? toInsert.jmbg,
        ime: newAdmin?.ime ?? toInsert.ime ?? null,
        prezime: newAdmin?.prezime ?? toInsert.prezime ?? null,
      });
    } catch (err: any) {
      logger.error?.("AuthRegisterRoute error", { err: err?.message ?? err });
      return error(res, "Greška pri registraciji", 500, err?.message ?? err);
    }
  }
}
