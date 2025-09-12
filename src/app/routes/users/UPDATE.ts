import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate } from "../../middlewares/auth";
import App from "../../core/App";
import { trimMax, isDateYYYYMMDD, esc } from "../../utils/helpers";

export default class UsersUpdateRoute extends AppRoutes {
  constructor(app: App) {
    super(app, {
      route: "/api/users",
      method: "patch",
      middlewares: [authenticate],
    });
  }

  async handle(req: Request, res: Response) {
    const id = Number(req.query.id);
    if (!Number.isFinite(id) || id <= 0) return error(res, "Neispravan ID", 400);

    const body = (req.body ?? {}) as Record<string, unknown>;

    const fieldConfig: Record<string, number | "date"> = {
      clanid: 6,
      ime: 32,
      prezime: 32,
      datum: "date",
      broj: 6,
      oznaka: 2,
      titulanaz: 64,
      titulaispis: 64,
      jmbg: 14,
      lozinka: 20,
    };

    const toUpdate: Record<string, any> = {};

    for (const [field, limit] of Object.entries(fieldConfig)) {
      if (!(field in body)) continue;
      const val = body[field];
      if (val === undefined || val === null) continue;

      if (limit === "date") {
        if (isDateYYYYMMDD(val)) toUpdate[field] = String(val);
      } else {
        if (typeof val !== "string") continue;
        const trimmed = trimMax(val, limit as number);
        if (trimmed === "") continue;
        toUpdate[field] = trimmed;
      }
    }

    if (Object.keys(toUpdate).length === 0) {
      return error(res, "Nema valjanih polja za ažuriranje", 400);
    }

    try {
      if (toUpdate.clanid || toUpdate.jmbg) {
        const dupeChecks: string[] = [];
        if (toUpdate.clanid) dupeChecks.push(`clanid='${esc(toUpdate.clanid)}'`);
        if (toUpdate.jmbg) dupeChecks.push(`jmbg='${esc(toUpdate.jmbg)}'`);
        if (dupeChecks.length) {
          const whereDupe = `(${dupeChecks.join(" OR ")}) AND id<>${id}`;
          const existing = await this.app.db.select(["bod_clan"], whereDupe);
          const rows = (existing as any)?.bod_clan as any[] | undefined;
          if (Array.isArray(rows) && rows.length) {
            return error(res, "clanid ili jmbg već postoji za drugog korisnika", 409);
          }
        }
      }

      const { data: updData, error: updErr } = await this.app.db.update('bod_clan', `id=${id}`, {  ...toUpdate as any });

      if (updErr) 
        return error(res, "Greška pri ažuriranju", 500, updErr);
      

      const sel = await this.app.db.select(["bod_clan"], `id=${id} LIMIT 1`);
      const rows = (sel?.bod_clan as any[]) || [];
      if (!rows.length) return error(res, "Korisnik nije pronađen nakon ažuriranja", 404);

      const u = rows[0];
      const user = {
        id: u.id,
        clanid: u.clanid,
        ime: u.ime,
        prezime: u.prezime,
        datum: u.datum,
        broj: u.broj,
        oznaka: u.oznaka,
        titulanaz: u.titulanaz,
        titulaispis: u.titulaispis,
        jmbg: u.jmbg,
      };

      return success(res, "Korisnik ažuriran", 200, { user });
    } catch (e: any) {
      return error(res, "Greška pri ažuriranju korisnika", 500, e?.message ?? e);
    }
  }
}
