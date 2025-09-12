import { Request, Response } from "express";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import App from "../../core/App";
import { trimMax, isDateYYYYMMDD, esc } from "../../utils/helpers";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

class AuthRegisterRoute extends AppRoutes {
  constructor(app: App) {
    super(app, { route: "/api/auth/register", method: "post", middlewares: [] });
  }

  public async handle(req: Request, res: Response) {
    const {
      clanid,
      ime,
      prezime,
      datum,
      broj,
      oznaka,
      titulanaz,
      titulaispis,
      jmbg,
      lozinka,
    } = (req.body ?? {}) as Record<string, unknown>;

    if (typeof lozinka !== "string" || (!clanid && !jmbg) || (typeof clanid !== "string" && typeof jmbg !== "string")) 
      return error(res, "Potrebni su clanid ili jmbg i lozinka", 400);
    

    const prepared = {
      clanid: trimMax(clanid, 6),
      ime: trimMax(ime, 32),
      prezime: trimMax(prezime, 32),
      datum: isDateYYYYMMDD(datum) ? String(datum) : null,
      broj: trimMax(broj, 6),
      oznaka: trimMax(oznaka, 2),
      titulanaz: trimMax(titulanaz, 64),
      titulaispis: trimMax(titulaispis, 64),
      jmbg: trimMax(jmbg, 14),
      lozinka: trimMax(lozinka, 20),
    };

    if (!prepared.lozinka) return error(res, "Lozinka je obavezna", 400);
    

    try {
      const dupeParts: string[] = [];
      if (prepared.clanid) dupeParts.push(`clanid='${esc(prepared.clanid)}'`);
      if (prepared.jmbg) dupeParts.push(`jmbg='${esc(prepared.jmbg)}'`);
      const where = dupeParts.length ? `(${dupeParts.join(" OR ")})` : "1=2";

      const existing = await this.app.db.select(["bod_clan"], where);
      const rows = (existing as any)?.bod_clan as any[] | undefined;
      if (Array.isArray(rows) && rows.length) return error(res, "Korisnik već postoji (clanid/jmbg)", 409);
      
    } catch (e: any) {
      return error(res, "Greška pri provjeri korisnika", 500, e?.message ?? e);
    }

    try {
      const toInsert: Record<string, any> = {};
      for (const [k, v] of Object.entries(prepared)) 
        if (v !== null && v !== undefined && v !== "") toInsert[k] = v;
      

      const { data, error: dbErr } = await this.app.db.insert("bod_clan", toInsert);
      if (dbErr) return error(res, "Greška pri registraciji", 500, dbErr);

      const insertId = Number((data?.insertId ?? data?.insertID) || 0);
      const payload = {
        id: insertId,
        clanid: prepared.clanid ?? null,
        ime: prepared.ime ?? null,
        prezime: prepared.prezime ?? null,
      };

      const token = jwt.sign(payload, JWT_SECRET as Secret, {
        expiresIn: JWT_EXPIRES,
      } as SignOptions);

      return success(res, "Registracija uspješna", 201, {
        type: "bearer",
        token,
        user: {
          id: insertId,
          clanid: prepared.clanid ?? null,
          ime: prepared.ime ?? null,
          prezime: prepared.prezime ?? null,
          datum: prepared.datum,
          broj: prepared.broj,
          oznaka: prepared.oznaka,
          titulanaz: prepared.titulanaz,
          titulaispis: prepared.titulaispis,
          jmbg: prepared.jmbg,
        },
      });
    } catch (err: any) {
      return error(res, "Greška pri registraciji", 500, err?.message ?? err);
    }
  }
}

export default AuthRegisterRoute;
