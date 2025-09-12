import VijestiRow from "./tables/vijesti";
import UserRow from "./tables/bod_clan";

export interface Database {
  vijesti: VijestiRow;
  bod_clan: UserRow;
}

export default Database;
