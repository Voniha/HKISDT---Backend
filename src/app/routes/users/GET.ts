import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate } from "../../middlewares/auth";
import App from "../../core/App";
import { clamp, esc } from "../../utils/helpers";

export default class UsersRoute extends AppRoutes {
  constructor(app: App) {
    super(app, {
      route: "/api/users",
      method: "get",
      middlewares: [authenticate],
    });
  }

  async handle(req: Request, res: Response) {
    const page = clamp(Number(req.query.page || 1), 1, 1_000_000);
    const rawLimit = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = rawLimit !== undefined && Number.isFinite(rawLimit) && rawLimit > 0 ? clamp(rawLimit, 1, 100) : undefined;
    const q = String(req.query.q || "").trim().toLowerCase();

    const orderByWhitelist = [
      "id",
      "clanid",
      "ime",
      "prezime",
      "datum",
      "broj",
      "oznaka",
      "titulanaz",
      "titulaispis",
      "jmbg",
    ];
    const orderBy = orderByWhitelist.includes(String(req.query.sort)) ? String(req.query.sort) : "id";
    const dir = String(req.query.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const effectivePage = limit ? page : 1;
    const offset = limit ? (effectivePage - 1) * limit : 0;

    const parts: string[] = [];
    if (q) {
      const like = `'%${esc(q)}%'`;
      parts.push(
        [
          `LOWER(ime) LIKE ${like}`,
          `LOWER(prezime) LIKE ${like}`,
          `LOWER(clanid) LIKE ${like}`,
          `LOWER(broj) LIKE ${like}`,
          `LOWER(oznaka) LIKE ${like}`,
          `LOWER(titulanaz) LIKE ${like}`,
          `LOWER(titulaispis) LIKE ${like}`,
          `LOWER(jmbg) LIKE ${like}`,
        ].join(" OR ")
      );
    }

    let where = parts.length ? `(${parts.join(") AND (")})` : "1=1";
    where += ` ORDER BY ${orderBy} ${dir}`;
    if (limit) where += ` LIMIT ${limit} OFFSET ${offset}`;

    try {
      const data = await this.app.db.select(["bod_clan"], where);
      const rows = (data?.bod_clan as any[]) || [];

      const users = rows.map((r) => ({
        id: r.id,
        clanid: r.clanid,
        ime: r.ime,
        prezime: r.prezime,
        datum: r.datum,
        broj: r.broj,
        oznaka: r.oznaka,
        titulanaz: r.titulanaz,
        titulaispis: r.titulaispis,
        jmbg: r.jmbg,
      }));

      return success(res, "Users fetched successfully", 200, {
        page: limit ? page : "ignored",
        limit: limit ?? "all",
        count: users.length,
        users,
      });
    } catch (e: any) {
      return error(res, "Failed to fetch users", 500, e?.message ?? e);
    }
  }
}
