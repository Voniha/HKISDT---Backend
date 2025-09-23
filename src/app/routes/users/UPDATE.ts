import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate } from "../../middlewares/auth";
import App from "../../core/App";
import { getTableColumns } from "../../utils/columns";
import { bod_clan_columns, trimMax, isDateYYYYMMDD, esc } from "../../utils/helpers";
import ClanoviRow from "../../types/Database/tables/HKST_EXPORTS/bod_clan";

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

    const candidate: Record<string, any> = {};
    for (const key of Object.keys(bod_clan_columns)) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      const raw = body[key];
      if (raw === undefined || raw === null) continue;

      const limit = bod_clan_columns[key];
      if (limit === "date") {
        if (isDateYYYYMMDD(raw)) candidate[key] = String(raw);
        continue;
      }

      if (typeof raw !== "string") continue;
      const v = trimMax(raw, limit as number);
      if (v === "") continue;
      candidate[key] = v;
    }

    if (Object.keys(candidate).length === 0) return error(res, "Nema valjanih polja za ažuriranje", 400);
    

    try {
      if (candidate.clanid || candidate.jmbg) {
        const checks: string[] = [];
        if (candidate.clanid) checks.push(`clanid='${esc(candidate.clanid)}'`);
        if (candidate.jmbg) checks.push(`jmbg='${esc(candidate.jmbg)}'`);
        if (checks.length) {
          const whereDupe = `(${checks.join(" OR ")}) AND id<>${id}`;
          const existing = await this.app.hkstWeb.select(["bod_clan"], whereDupe);
          const rows = (existing as any)?.bod_clan as any[] | undefined;
          if (Array.isArray(rows) && rows.length) {
            return error(res, "clanid ili jmbg već postoji za drugog korisnika", 409);
          }
        }
      }

      const allowedCols = await getTableColumns(this.app, "bod_clan");
      const toUpdate: Record<string, any> = {};
      for (const [k, v] of Object.entries(candidate)) {
        if (allowedCols.has(k)) toUpdate[k] = v;
      }

      if (Object.keys(toUpdate).length === 0) return error(res, "Nijedno polje za ažuriranje nije prisutno u tablici", 400);
      
      const { data: updData, error: updErr } = await this.app.hkstWeb.update(
        "bod_clan",
        `id=${id}`,
        toUpdate as ClanoviRow 
      );

      if (updErr) return error(res, "Greška pri ažuriranju", 500, updErr);
      if ((updData?.affectedRows ?? 0) === 0) return error(res, "Korisnik nije pronađen", 404);
      
      const sel = await this.app.hkstWeb.select(["bod_clan"], `id=${id} LIMIT 1`);
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
