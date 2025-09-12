const VALID_FIELDS = ["id", "email", "role", "created_at", "avatar"] as const;
type Field = (typeof VALID_FIELDS)[number];

function toList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .flatMap((s) => String(s).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (v == null) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const esc = (v: string) =>
  String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const trimMax = (v: unknown, n: number) =>
  typeof v === "string" ? v.trim().slice(0, n) : null;

const isDateYYYYMMDD = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export { toList, esc, clamp, VALID_FIELDS, Field, trimMax, isDateYYYYMMDD };
