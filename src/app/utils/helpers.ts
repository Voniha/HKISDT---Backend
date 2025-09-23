// src/utils/helpers.ts
import bcrypt from "bcrypt";
import crypto from "crypto";

export const VALID_FIELDS = ["id", "email", "role", "created_at", "avatar"] as const;
export type Field = (typeof VALID_FIELDS)[number];

export function toList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.flatMap((s) => String(s).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}

export function esc(v: string) {
  return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function clamp(n: number, min: number, max: number) {
  const num = Number(n);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

export function trimMax(v: unknown, n: number): string | null {
  if (v == null) return null;
  return String(v).trim().slice(0, n);
}

export function isDateYYYYMMDD(v: unknown): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function norm(v?: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export const q = (v: string) => `'${esc(v)}'`;

export async function verifyPassword(stored?: string | null, supplied = ""): Promise<boolean> {
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

export type FieldLimit = number | "date";

export const bod_clan_columns: Record<string, FieldLimit> = {
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

export type LoginBody = { clanid?: string; jmbg?: string; lozinka?: string };

export function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")                   // split an accented letter in the base letter and the accent
    .replace(/[\u0300-\u036f]/g, "")   // remove all previously split accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')       // replace all non-alphanumeric characters with -
    .replace(/--+/g, '-')              // replace multiple - with single -
    .replace(/^-+/, '')                // trim - from start of text
    .replace(/-+$/, '');              
}