import { Request, Response } from "express";
import { AppRoutes } from "../../types/App/routes";
import { success, error } from "../../utils/responses";
import { authenticate } from "../../middlewares/auth";
import App from "../../core/App";
import { clamp, esc } from "../../utils/helpers";
import { getTableColumns, getDir } from "../../utils/columns";

export default class NewsListRoute extends AppRoutes {
  constructor(app: App) {
    super(app, { route: "/api/news", method: "get", middlewares: [] });
  }

  async handle(req: Request, res: Response) {
    const page = clamp(Number(req.query.page || 1), 1, 1_000_000);
    const rawLimit = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = rawLimit !== undefined && Number.isFinite(rawLimit) && rawLimit > 0 ? clamp(rawLimit, 1, 200) : undefined;
    const q = String(req.query.q || "").trim().toLowerCase();
    const dir = getDir(req.query.dir);
    const offset = limit ? (page - 1) * limit : 0;

    const parts: string[] = [];
    if (q) {
      const like = `'%${esc(q)}%'`;
      parts.push(
        [
          `LOWER(title) LIKE ${like}`,
          `LOWER(alias) LIKE ${like}`,
          `LOWER(introtext_clean) LIKE ${like}`,
          `LOWER(fulltext_clean) LIKE ${like}`
        ].join(" OR ")
      );
    }

    try {
      const allowed = await getTableColumns(this.app, "vijesti");
      const requestedSort = String(req.query.sort ?? "id").trim();
      const orderBy = allowed.has(requestedSort) ? requestedSort : "id";

      let where = parts.length ? `(${parts.join(") AND (")})` : "1=1";
      where += ` ORDER BY ${orderBy} ${dir}`;
      if (limit) where += ` LIMIT ${limit} OFFSET ${offset}`;

      const data = await this.app.hkstExports.select(["vijesti"], where);
      const rows = (data?.vijesti as any[]) || [];

      const items = rows.map(r => ({
        id: r.id,
        title: r.title,
        alias: r.alias,
        introtext_clean: r.introtext_clean ?? null,
        introtext: r.introtext ?? null,
        fulltext: r.fulltext ?? null,
        images: r.images ?? null,
        created: r.created ?? null,
        publish_up: r.publish_up ?? null,
        publish_down: r.publish_down ?? null,
        hits: r.hits ?? 0
      }));

      return success(res, "News fetched successfully", 200, {
        page: limit ? page : "ignored",
        limit: limit ?? "all",
        count: items.length,
        items
      });
    } catch (e: any) {
      return error(res, "Failed to fetch news", 500, e?.message ?? e);
    }
  }
}
