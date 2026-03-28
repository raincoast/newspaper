export type DeliveryStatus = "pending" | "delivered" | "blocked"

export type HouseMarkerDTO = {
  id: string
  street_name: string
  current_housenumber: string
  osm_default_housenumber: string
  display_label: string
  delivery_status: DeliveryStatus
  lat: number
  lng: number
  is_selected_by_rule: boolean
  is_manually_excluded: boolean
  is_manually_added: boolean
  is_number_overridden: boolean
  is_conflict: boolean
  conflict_peer_ids: string[]
  is_delivery_focus: boolean
  /** 客户端叠加：规则匹配高亮（预览或 is_selected_by_rule） */
  rule_highlight?: boolean
  last_delivered_at: string | null
  last_delivery_update_at: string | null
}

export type MapBoundsRing = { lng: number; lat: number }[]

export type RegionLite = {
  id: string
  name: string
  mapBoundsRing?: MapBoundsRing | null
  assigned?: boolean
}

export type ApartmentGroupOverlay = {
  id: string
  count: number
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
  centerLat: number
  centerLng: number
}

