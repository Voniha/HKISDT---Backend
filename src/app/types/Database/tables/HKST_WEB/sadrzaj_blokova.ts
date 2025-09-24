export type ID = number;
export type Timestamp = string | Date;
export type BlokVrsta = "naslov" | "podnaslov" | "tekst" | "slika" | "dokument";

export interface BlokoviSadrzaja {
  id: ID;
  stranica_id: ID;
  vrsta: BlokVrsta;
  sadrzaj: string | null;
  url: string | null;
  pozicija: number;
  dokument_id: ID | null;
  kreirano?: Timestamp;
  azurirano?: Timestamp;
}
