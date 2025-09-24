import VijestiRow from "./tables/HKST_EXPORTS/vijesti";
import UserRow from "./tables/HKST_EXPORTS/bod_clan";
import AdminsRow from "./tables/HKST_WEB/admins";
import StraniceRow from "./tables/HKST_WEB/stranice";
import DokumentiRow from "./tables/HKST_WEB/dokumenti";
import { BlokoviSadrzaja } from "./tables/HKST_WEB/sadrzaj_blokova";


export interface Database {
  vijesti: VijestiRow;
  bod_clan: UserRow;
  admins: AdminsRow;
  stranice: StraniceRow;
  dokumenti: DokumentiRow;
  blokovi_sadrzaja: BlokoviSadrzaja;
}

export default Database;
