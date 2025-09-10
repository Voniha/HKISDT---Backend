import mysql from "mysql2/promise";
import type TableMap from "../types/Database/index";

export const mysqlConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "hkšt",
  charset: "utf8mb4",
};

export default class MySqlDatabase {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool(mysqlConfig);
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
}
