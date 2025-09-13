import bcrypt from "bcrypt";
import crypto from "crypto";

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

function norm(v?: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const q = (v: string) => `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function verifyPassword(stored?: string | null, supplied = ""): Promise<boolean> {
  if (!stored) return false;
  const s = String(stored);
  if (/^\$2[aby]\$/.test(s)) {
    try {
      return await bcrypt.compare(supplied, s);
    } catch {
      return false;
    }
  }
  try {
    const a = Buffer.from(s);
    const b = Buffer.from(supplied);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return s === supplied;
  }
}

export { toList, esc, clamp, VALID_FIELDS, Field, trimMax, isDateYYYYMMDD, norm, q, verifyPassword };
