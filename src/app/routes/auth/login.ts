// src/routes/auth.login.route.ts
import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import App from "../../core/App";
import ClanoviRow from "../../types/Database/tables/bod_clan";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

const q = (v: string) =>
  `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

class AuthLoginRoute extends AppRoutes {
  constructor(app: App) {
    super(app, { route: "/api/auth/login", method: "post", middlewares: [] });
  }

  public async handle(req: Request, res: Response) {
    const { clanid, jmbg, lozinka } = req.body ?? {};

    if ((typeof clanid !== "string" && typeof jmbg !== "string") || typeof lozinka !== "string") {
      return error(res, "Potrebni su clanid ili jmbg i lozinka", 400);
    }

    try {
      const idField = typeof clanid === "string" && clanid.trim() ? "clanid" : "jmbg";
      const idValue = idField === "clanid" ? String(clanid).trim() : String(jmbg).trim();

      const where = `${idField} = ${q(idValue)} LIMIT 1`;
      const data = await this.app.db.select(["bod_clan"], where);
      const rows = (data?.bod_clan as ClanoviRow[]) ?? [];

      if (!rows.length) return error(res, "Neispravni podaci", 401);

      const user = rows[0];

      const valid = String(user.lozinka ?? "") === lozinka;
      if (!valid) return error(res, "Neispravni podaci", 401);

      const payload = {
        id: user.id,
        clanid: user.clanid,
        ime: user.ime,
        prezime: user.prezime,
        role: user.role
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as SignOptions);

      return success(res, "Prijava uspješna", 200, {
        type: "bearer",
        token,
        user: {
          id: user.id,
          clanid: user.clanid,
          ime: user.ime,
          prezime: user.prezime,
          datum: user.datum,
          broj: user.broj,
          oznaka: user.oznaka,
          titulanaz: user.titulanaz,
          titulaispis: user.titulaispis,
          jmbg: user.jmbg,
        },
      });
    } catch (e: any) {
      return error(res, "Greška pri prijavi", 500, e?.message ?? e);
    }
  }
}

export default AuthLoginRoute;
