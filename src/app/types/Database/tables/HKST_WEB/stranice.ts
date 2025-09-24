export type ID = number;
export type Timestamp = string | Date;

export default interface Stranice {
  id: ID;
  nadrazina_id: ID | null;
  naslov: string;
  slug: string;
  pozicija?: number | null;
  kreirano?: Timestamp;
  azurirano?: Timestamp;
}