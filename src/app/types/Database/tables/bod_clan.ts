export interface ClanoviRow {
  id: number;
  clanid: string | null;
  ime: string | null;
  prezime: string | null;
  datum: string | Date | null;
  broj: string | null;
  oznaka: string | null;
  titulanaz: string | null;
  titulaispis: string | null;
  jmbg: string | null;
  lozinka: string | null;
}

export default ClanoviRow;
