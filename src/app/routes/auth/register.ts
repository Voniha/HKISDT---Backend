import { Request, Response } from "express";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import App from "../../core/App";
import { trimMax, esc } from "../../utils/helpers";
import ReqBody from "../../types/App/authTypes";
import AdminsRow from "../../types/Database/tables/HKST_WEB/admins";
import { authenticate, authorize } from "../../middlewares/auth";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const SIGN_OPTS: SignOptions = { expiresIn: JWT_EXPIRES as SignOptions["expiresIn"] };

class AuthRegisterRoute extends AppRoutes {
  constructor(app: App) {
    super(app, { route: "/api/auth/register", method: "post", middlewares: [authenticate, authorize("admin")] });
  }

  public async handle(req: Request<any, any, ReqBody>, res: Response) {
    const { ime, prezime, jmbg } = req.body ?? {};
    const prepared = {
      ime: trimMax(ime, 32),
      prezime: trimMax(prezime, 32),
      jmbg: trimMax(jmbg, 14),
    };

    if (!prepared.jmbg) return error(res, "Za admin registraciju obavezan je jmbg", 400);

    try {
      const where = `jmbg='${esc(prepared.jmbg)}' LIMIT 1`;
      const existing = await this.app.hkstWeb.select(["admins"], where);
      const admins = (existing?.admins as AdminsRow[]) ?? [];
      if (admins.length) return error(res, "Admin s tim JMBG već postoji", 409);

      const toInsert: Record<string, any> = { jmbg: prepared.jmbg };
      if (prepared.ime) toInsert.ime = prepared.ime;
      if (prepared.prezime) toInsert.prezime = prepared.prezime;

      const { data, error: dbErr } = await this.app.hkstWeb.insert("admins", toInsert);
      if (dbErr) return error(res, "Greška pri registraciji (admin)", 500, dbErr);

      const insertId = Number((data?.insertId ?? data?.insertID) || 0);
      const payload = { id: insertId, jmbg: prepared.jmbg, ime: prepared.ime ?? null, prezime: prepared.prezime ?? null, role: "admin" as const };
      const token = jwt.sign(payload, JWT_SECRET as Secret, SIGN_OPTS);

      return success(res, "Registracija uspješna (admin)", 201, {
        type: "bearer",
        token,
        user: { id: insertId, jmbg: prepared.jmbg, ime: prepared.ime ?? null, prezime: prepared.prezime ?? null, role: "admin" },
      });
    } catch (err: any) {
      return error(res, "Greška pri registraciji", 500, err?.message ?? err);
    }
  }
}

export default AuthRegisterRoute;
