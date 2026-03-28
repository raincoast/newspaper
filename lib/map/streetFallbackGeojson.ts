import type { FeatureCollection } from "geojson"

export type BoundsRingPoint = { lng: number; lat: number }

export function pointInPolygonRing(lng: number, lat: number, ring: BoundsRingPoint[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i]
    const pj = ring[j]
    const intersect =
      pi.lat > lat !== pj.lat > lat &&
      lng < ((pj.lng - pi.lng) * (lat - pi.lat)) / (pj.lat - pi.lat + 1e-18) + pi.lng
    if (intersect) inside = !inside
  }
  return inside
}

/** 框内门牌按街道聚类，用线段承载路名（OSM 无数据时的回退） */
export function buildStreetFallbackFromMarkers(
  markers: Array<{ lng: number; lat: number; street_name: string }>,
  ring: BoundsRingPoint[]
): FeatureCollection {
  const inPoly = markers.filter((m) => pointInPolygonRing(m.lng, m.lat, ring))
  const byStreet = new Map<string, { lng: number; lat: number }[]>()
  for (const m of inPoly) {
    const k = m.street_name.trim()
    if (!k) continue
    const arr = byStreet.get(k) ?? []
    arr.push({ lng: m.lng, lat: m.lat })
    byStreet.set(k, arr)
  }
  const features: FeatureCollection["features"] = []
  for (const [name, pts] of byStreet) {
    if (pts.length === 0) continue
    pts.sort((a, b) => a.lng - b.lng || a.lat - b.lat)
    const a = pts[0]
    const b =
      pts.length === 1 ? { lng: a.lng + 1e-5, lat: a.lat + 1e-5 } : pts[pts.length - 1]
    features.push({
      type: "Feature",
      properties: { name, source: "marker_fallback" },
      geometry: {
        type: "LineString",
        coordinates: [
          [a.lng, a.lat],
          [b.lng, b.lat]
        ]
      }
    })
  }
  return { type: "FeatureCollection", features }
}

/** OSM 优先；仅补充 OSM 未覆盖的街道名 */
export function mergeStreetNameFeatures(
  osm: FeatureCollection,
  fallback: FeatureCollection
): FeatureCollection {
  const names = new Set<string>()
  for (const f of osm.features) {
    const n = (f.properties as { name?: string } | null)?.name
    if (typeof n === "string" && n.trim()) names.add(n.trim())
  }
  const extra = fallback.features.filter((f) => {
    const n = (f.properties as { name?: string } | null)?.name
    return typeof n === "string" && n.trim().length > 0 && !names.has(n.trim())
  })
  return { type: "FeatureCollection", features: [...osm.features, ...extra] }
}
