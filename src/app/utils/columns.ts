let columnsCache: Record<string, Set<string>> = {};

export function getDir(q: unknown): "asc" | "desc" {
  return String(q ?? "").toLowerCase() === "asc" ? "asc" : "desc";
}

type DbClientName = "hkstExports" | "hkstWeb" | undefined;

export async function getTableColumns(app: any, table: string, client?: DbClientName): Promise<Set<string>> {
  const cacheKey = `${String(client ?? "auto")}:${table}`;
  if (columnsCache[cacheKey]) return columnsCache[cacheKey];

  const tryFromInformationSchema = async (): Promise<Set<string> | null> => {
    if (typeof app.db?.raw !== "function") return null;
    const q = `SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`;
    try {
      const res = await app.db.raw(q, [table]);
      const rows = (res?.[0] ?? res) as any[] || [];
      const cols = new Set<string>(rows
        .map(r => String(r.COLUMN_NAME ?? r.column_name ?? "").trim())
        .filter(Boolean));
      return cols.size ? cols : null;
    } catch {
      return null;
    }
  };

  const tryFromSelectOne = async (clientName: DbClientName): Promise<Set<string> | null> => {
    const c = clientName ? app[clientName] : undefined;
    if (!c || typeof c.select !== "function") return null;
    try {
      const sample = await c.select([table], "1=1 LIMIT 1");
      const row = (sample?.[table] as any[])?.[0];
      if (!row || typeof row !== "object") return null;
      const cols = new Set<string>(Object.keys(row).map(k => String(k).trim()).filter(Boolean));
      return cols.size ? cols : null;
    } catch {
      return null;
    }
  };

  let cols: Set<string> | null = null;

  cols = await tryFromInformationSchema();
  if (!cols) {
    if (client === "hkstExports") cols = await tryFromSelectOne("hkstExports");
    if (!cols && client === "hkstWeb") cols = await tryFromSelectOne("hkstWeb");
    if (!cols && !client) {
      cols = await tryFromSelectOne("hkstExports");
      if (!cols) cols = await tryFromSelectOne("hkstWeb");
    }
  }
  if (!cols) cols = new Set<string>();

  columnsCache[cacheKey] = cols;
  return cols;
}
