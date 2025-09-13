import VijestiRow from "./tables/HKST_EXPORTS/vijesti";
import UserRow from "./tables/HKST_EXPORTS/bod_clan";
import AdminsRow from "./tables/HKST_WEB/admins";

export interface Database {
  vijesti: VijestiRow;
  bod_clan: UserRow;
  admins: AdminsRow;
}

export default Database;
