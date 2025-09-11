export interface VijestiRow {
  id: number
  title: string
  alias: string
  title_alias: string
  introtext: string | null
  fulltext: string | null
  state: number
  sectionid: number
  mask: number
  catid: number
  created: string | null
  created_by: number
  created_by_alias: string | null
  modified: string | null
  modified_by: number | null
  checked_out: number | null
  checked_out_time: string | null
  publish_up: string | null
  publish_down: string | null
  images: string | null
  urls: string | null
  attribs: string | null
  version: number
  parentid: number
  ordering: number
  metakey: string | null
  metadesc: string | null
  access: number
  hits: number
  metadata: string | null
  introtext_clean: string | null
  fulltext_clean: string | null
}
export default VijestiRow
