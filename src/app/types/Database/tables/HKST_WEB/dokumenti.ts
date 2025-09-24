export type ID = number;
export type Timestamp = string | Date;

export default interface Dokumenti {
  id: ID;
  datoteka_blob: Buffer;
  naziv_datoteke: string;
  mime_tip: string;
  velicina_bajtova: number;
  sha256?: string | null;
  kreirano?: Timestamp;
}
