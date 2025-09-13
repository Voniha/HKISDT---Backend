import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import App from "../../core/App";
import ClanoviRow from "../../types/Database/tables/HKST_EXPORTS/bod_clan";
import AdminsRow from "../../types/Database/tables/HKST_WEB/admins";
import { norm, q, verifyPassword } from "../../utils/helpers"

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const SIGN_OPTS: SignOptions = { expiresIn: JWT_EXPIRES as SignOptions["expiresIn"] };

type LoginBody = { clanid?: string; jmbg?: string; lozinka?: string };

class AuthLoginRoute extends AppRoutes {
  constructor(app: App) {
    super(app, { route: "/api/auth/login", method: "post", middlewares: [] });
  }

  public async handle(req: Request<{}, {}, LoginBody>, res: Response) {
    const logger = (this.app as any)?.logger ?? console;
    const clanid = norm(req.body?.clanid);
    const jmbg = norm(req.body?.jmbg);
    const lozinka = norm(req.body?.lozinka);

    if ((!clanid && !jmbg) || !lozinka) return error(res, "Potrebni su clanid ili jmbg i lozinka", 400);

    try {
      if (jmbg) {
        const whereAdmin = `jmbg = ${q(jmbg)} LIMIT 1`;
        const dataAdmin = await this.app.hkstWeb.select(["admins"], whereAdmin);
        const admins = (dataAdmin?.admins as AdminsRow[]) ?? [];
        if (admins.length) {
          const admin = admins[0];
          const payload = { sub: String(admin.id), role: "admin" as const, jmbg: admin.jmbg ?? null };
          const token = jwt.sign(payload, JWT_SECRET, SIGN_OPTS);
          logger.info?.("Auth: admin login", { adminId: admin.id });
          return success(res, "Prijava uspješna", 200, {
            type: "bearer",
            token,
            user: { id: admin.id, jmbg: admin.jmbg, ime: admin.ime, prezime: admin.prezime, role: "admin" },
          });
        }
      }

      const idField = clanid ? "clanid" : "jmbg";
      const idValue = clanid || jmbg!;
      const whereMember = `${idField} = ${q(idValue)} LIMIT 1`;
      const dataMember = await this.app.hkstExports.select(["bod_clan"], whereMember);
      const members = (dataMember?.bod_clan as ClanoviRow[]) ?? [];
      if (!members.length) return error(res, "Neispravni podaci", 401);

      const member = members[0];
      const ok = await verifyPassword(member.lozinka as any, lozinka);
      if (!ok) return error(res, "Neispravni podaci", 401);

      const role = (member.role as string) || "user";
      const payload = { sub: String(member.id), role, clanid: member.clanid ?? null };
      const token = jwt.sign(payload, JWT_SECRET, SIGN_OPTS);

      logger.info?.("Auth: member login", { memberId: member.id });

      return success(res, "Prijava uspješna", 200, {
        type: "bearer",
        token,
        user: {
          id: member.id,
          clanid: member.clanid,
          ime: member.ime,
          prezime: member.prezime,
          datum: member.datum,
          broj: member.broj,
          oznaka: member.oznaka,
          titulanaz: member.titulanaz,
          titulaispis: member.titulaispis,
          jmbg: member.jmbg,
          role,
        },
      });
    } catch (err: any) {
      logger.error?.("AuthLoginRoute error", { err: err?.message ?? err });
      return error(res, "Greška pri prijavi", 500, (err && err.message) || err);
    }
  }
}

export default AuthLoginRoute;
