import mysql, { PoolConnection } from "mysql2/promise";
import type TableMap from "../types/Database/index";
import Logger from "../utils/logger";

export const mysqlConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME_WEB || "hkšt_web",
  charset: "utf8mb4_croatian_ci",
};

class HKSTWEB {
  private pool: mysql.Pool;
  private log = new Logger('info', 'Database:web');

  constructor() {
    this.pool = mysql.createPool(mysqlConfig);
    this.ping().then((ok) => {
      if (ok) this.log.info("MySQL connected");
      else this.log.error("MySQL connection failed");
    });
  }

  public async query(sql: string, params?: any[]): Promise<any> {
    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  public async execute(sql: string, params?: any[]): Promise<any> {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  public async select<T extends keyof TableMap>(
    tables: (T | "")[],
    where?: string
  ): Promise<any> {
    const out: Record<string, any> = {};
    const wanted = (tables || []).map(t => String(t || "").trim());
    const nonEmpty = wanted.filter(Boolean);
    if (!nonEmpty.length) {
      const rows = await this.query("SHOW TABLES");
      const list = Array.isArray(rows) ? rows.map((r: any) => String(Object.values(r)[0])) : [];
      return { tables: list };
    }
    await Promise.all(nonEmpty.map(async (table) => {
      const t = String(table);
      let sql = `SELECT * FROM \`${t}\``;
      if (where && where.trim()) sql += ` WHERE ${where}`;
      try {
        const rows = await this.query(sql);
        out[t] = rows;
      } catch (e: any) {
        out[t] = { error: e?.message ?? e };
      }
    }));
    return out;
  }

  public async insert<T extends keyof TableMap>(
    table: T | "",
    data: Partial<TableMap[T]>
  ): Promise<{ data: any; error: any | null }> {
    if (!String(table || "").trim()) {
      const rows = await this.query("SHOW TABLES");
      const list = Array.isArray(rows) ? rows.map((r: any) => String(Object.values(r)[0])) : [];
      return { data: { tables: list }, error: null };
    }
    const keys = Object.keys(data || {});
    if (!keys.length) return { data: null, error: "No data" };
    const placeholders = keys.map(() => "?").join(", ");
    const cols = keys.map(k => `\`${k}\``).join(", ");
    const values = keys.map(k => {
      const v = (data as any)[k];
      return (Array.isArray(v) || typeof v === "object") ? JSON.stringify(v) : v;
    });
    const sql = `INSERT INTO \`${String(table)}\` (${cols}) VALUES (${placeholders})`;
    try {
      const rows = await this.query(sql, values);
      return { data: rows, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

  public async update<T extends keyof TableMap>(
    table: T | "",
    where: string,
    data: TableMap[T]
  ): Promise<{ data: any; error: any | null }> {
    if (!String(table || "").trim()) {
      const rows = await this.query("SHOW TABLES");
      const list = Array.isArray(rows) ? rows.map((r: any) => String(Object.values(r)[0])) : [];
      return { data: { tables: list }, error: null };
    }
    const keys = Object.keys(data || {});
    if (!keys.length) return { data: null, error: "No data" };
    const set = keys.map(k => `\`${k}\` = ?`).join(", ");
    const values = keys.map(k => {
      const v = (data as any)[k];
      return (Array.isArray(v) || typeof v === "object") ? JSON.stringify(v) : v;
    });
    const sql = `UPDATE \`${String(table)}\` SET ${set} WHERE ${where}`;
    try {
      const rows = await this.execute(sql, values);
      return { data: rows, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

  public async delete<T extends keyof TableMap>(
    table: T | "",
    where: string
  ): Promise<{ data: any; error: any | null }> {
    if (!String(table || "").trim()) {
      const rows = await this.query("SHOW TABLES");
      const list = Array.isArray(rows) ? rows.map((r: any) => String(Object.values(r)[0])) : [];
      return { data: { tables: list }, error: null };
    }
    const sql = `DELETE FROM \`${String(table)}\` WHERE ${where}`;
    try {
      const rows = await this.execute(sql);
      return { data: rows, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

  async ping(): Promise<boolean> {
    let conn: PoolConnection | undefined;
    try {
      conn = await this.pool.getConnection();
      await conn?.ping();
      return true;
    } catch (err) {
      this.log.error("MySQL connection error", err);
      return false;
    } finally {
      conn?.release();
    }
  }

  public async raw(sql: string): Promise<any> {
    try {
      const rows = await this.query(sql);
      return rows;
    } catch (e: any) {
      return { error: e?.message ?? e };
    }
  }

    public async getPageDocuments(
    opts: { pageId?: number; pageSlug?: string; includeChildren?: boolean; }
  ): Promise<{ data: any; error: any | null }> {
    const { pageId, pageSlug, includeChildren = false } = opts || {};

    try {
      let pid: number | null = pageId ?? null;

      if (!pid && pageSlug && String(pageSlug).trim()) {
        const slug = String(pageSlug).trim();
        const rows = await this.query("SELECT id FROM `stranice` WHERE slug = ? LIMIT 1", [slug]);
        pid = (Array.isArray(rows) && rows[0] && rows[0].id) ? Number(rows[0].id) : null;
      }

      if (!pid) {
        return { data: null, error: "Nedostaje pageId ili pageSlug" };
      }

      let sql: string;
      let params: any[] = [];

      if (includeChildren) {
        sql = `
          WITH RECURSIVE pages_cte AS (
            SELECT id FROM \`stranice\` WHERE id = ?
            UNION ALL
            SELECT s.id FROM \`stranice\` s JOIN pages_cte p ON s.nadrazina_id = p.id
          )
          SELECT
            b.id AS blok_id,
            b.stranica_id,
            b.pozicija,
            b.sadrzaj AS blok_label,
            b.url AS eksterni_url,
            d.id AS dokument_id,
            d.naziv_datoteke,
            d.mime_tip,
            d.velicina_bajtova,
            d.sha256,
            d.kreirano AS dokument_kreirano
          FROM \`blokovi_sadrzaja\` b
          LEFT JOIN \`dokumenti\` d ON d.id = b.dokument_id
          WHERE b.vrsta = 'dokument' AND b.stranica_id IN (SELECT id FROM pages_cte)
          ORDER BY b.stranica_id, b.pozicija, b.id
        `;
        params = [pid];
      } else {
        sql = `
          SELECT
            b.id AS blok_id,
            b.stranica_id,
            b.pozicija,
            b.sadrzaj AS blok_label,
            b.url AS eksterni_url,
            d.id AS dokument_id,
            d.naziv_datoteke,
            d.mime_tip,
            d.velicina_bajtova,
            d.sha256,
            d.kreirano AS dokument_kreirano
          FROM \`blokovi_sadrzaja\` b
          LEFT JOIN \`dokumenti\` d ON d.id = b.dokument_id
          WHERE b.vrsta = 'dokument' AND b.stranica_id = ?
          ORDER BY b.pozicija, b.id
        `;
        params = [pid];
      }

      const rows = await this.query(sql, params);
      return { data: rows, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }

}

export default HKSTWEB;
