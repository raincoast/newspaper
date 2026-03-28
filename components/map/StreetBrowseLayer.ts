import type { FeatureCollection } from "geojson"
import type { GeoJSONSource, Map } from "maplibre-gl"

import { HOUSE_MARKER_BEFORE_LAYER_ID } from "./HouseMarkerLayer"
import type { RingPoint } from "./regionBoundsEditor"

export const REGION_BROWSE_SOURCE = "region-browse-source"
export const REGION_BROWSE_FILL_LAYER = "region-browse-fill-layer"
export const REGION_BROWSE_LINE_LAYER = "region-browse-line-layer"

export const STREET_BROWSE_SOURCE = "street-browse-source"
export const STREET_BROWSE_LINE_LAYER = "street-browse-line-layer"
/** 置于最顶层，保证沿道路可点且优先于门牌圆点 */
export const STREET_BROWSE_HIT_TOP_LAYER = "street-browse-hit-top-layer"
export const STREET_BROWSE_SYMBOL_LAYER = "street-browse-symbol-layer"

export const STREET_BROWSE_CLICK_LAYERS = [
  STREET_BROWSE_HIT_TOP_LAYER,
  STREET_BROWSE_SYMBOL_LAYER,
  STREET_BROWSE_LINE_LAYER
] as const

function emptyFc(): FeatureCollection {
  return { type: "FeatureCollection", features: [] }
}

function ringToPolygonFc(ring: RingPoint[]): FeatureCollection {
  const coords = ring.map((p) => [p.lng, p.lat] as [number, number])
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]])
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coords]
        }
      }
    ]
  }
}

function ensureRegionLayers(map: Map) {
  if (map.getSource(REGION_BROWSE_SOURCE)) return
  const before = map.getLayer(HOUSE_MARKER_BEFORE_LAYER_ID) ? HOUSE_MARKER_BEFORE_LAYER_ID : undefined

  map.addSource(REGION_BROWSE_SOURCE, { type: "geojson", data: emptyFc() })
  map.addLayer(
    {
      id: REGION_BROWSE_FILL_LAYER,
      type: "fill",
      source: REGION_BROWSE_SOURCE,
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": 0.06
      }
    },
    before
  )
  map.addLayer(
    {
      id: REGION_BROWSE_LINE_LAYER,
      type: "line",
      source: REGION_BROWSE_SOURCE,
      paint: {
        "line-color": "#86efac",
        "line-width": 2,
        "line-dasharray": [2, 2],
        "line-opacity": 0.95
      }
    },
    before
  )
}

function ensureStreetLayers(map: Map) {
  if (map.getSource(STREET_BROWSE_SOURCE)) return
  const before = map.getLayer(HOUSE_MARKER_BEFORE_LAYER_ID) ? HOUSE_MARKER_BEFORE_LAYER_ID : undefined

  map.addSource(STREET_BROWSE_SOURCE, { type: "geojson", data: emptyFc() })
  map.addLayer(
    {
      id: STREET_BROWSE_LINE_LAYER,
      type: "line",
      source: STREET_BROWSE_SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#93c5fd",
        "line-width": 2,
        "line-opacity": 0.35
      }
    },
    before
  )
  map.addLayer({
    id: STREET_BROWSE_SYMBOL_LAYER,
    type: "symbol",
    source: STREET_BROWSE_SOURCE,
    layout: {
      "symbol-placement": "line",
      "text-field": ["get", "name"],
      "text-size": 13,
      "text-font": ["Noto Sans Bold", "Arial Unicode MS Bold", "Noto Sans Regular"],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "text-padding": 2
    },
    paint: {
      "text-color": "#1d4ed8",
      "text-halo-color": "rgba(255,255,255,0.92)",
      "text-halo-width": 2,
      "text-halo-blur": 0.6
    }
  })
  map.addLayer({
    id: STREET_BROWSE_HIT_TOP_LAYER,
    type: "line",
    source: STREET_BROWSE_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#000000",
      "line-width": 16,
      "line-opacity": 0
    }
  })
}

export function setStreetBrowseVisible(map: Map, active: boolean) {
  const hitWidth = active ? 16 : 0
  for (const layerId of [
    REGION_BROWSE_FILL_LAYER,
    REGION_BROWSE_LINE_LAYER,
    STREET_BROWSE_LINE_LAYER,
    STREET_BROWSE_SYMBOL_LAYER
  ]) {
    if (!map.getLayer(layerId)) continue
    if (layerId === REGION_BROWSE_FILL_LAYER) {
      map.setPaintProperty(layerId, "fill-opacity", active ? 0.06 : 0)
    } else if (layerId === REGION_BROWSE_LINE_LAYER) {
      map.setPaintProperty(layerId, "line-opacity", active ? 0.95 : 0)
    } else if (layerId === STREET_BROWSE_LINE_LAYER) {
      map.setPaintProperty(layerId, "line-opacity", active ? 0.35 : 0)
    } else if (layerId === STREET_BROWSE_SYMBOL_LAYER) {
      map.setPaintProperty(layerId, "text-opacity", active ? 1 : 0)
    }
  }
  if (map.getLayer(STREET_BROWSE_HIT_TOP_LAYER)) {
    map.setPaintProperty(STREET_BROWSE_HIT_TOP_LAYER, "line-opacity", 0)
    map.setPaintProperty(STREET_BROWSE_HIT_TOP_LAYER, "line-width", hitWidth)
  }
}

export function upsertStreetBrowseOverlay(
  map: Map,
  opts: {
    active: boolean
    ring: RingPoint[] | null
    streets: FeatureCollection | null
  }
) {
  if (!map.isStyleLoaded()) return

  ensureRegionLayers(map)
  ensureStreetLayers(map)

  const regionSrc = map.getSource(REGION_BROWSE_SOURCE) as GeoJSONSource
  const streetSrc = map.getSource(STREET_BROWSE_SOURCE) as GeoJSONSource

  if (opts.active && opts.ring && opts.ring.length === 4) {
    regionSrc.setData(ringToPolygonFc(opts.ring))
  } else {
    regionSrc.setData(emptyFc())
  }

  if (opts.active && opts.streets && opts.streets.features.length > 0) {
    streetSrc.setData(opts.streets)
  } else {
    streetSrc.setData(emptyFc())
  }

  setStreetBrowseVisible(map, Boolean(opts.active && opts.ring && opts.ring.length === 4))
  bringStreetBrowseLayersToTop(map)
}

/** 将道路标签与点击热区移到最顶层，避免被后增的门牌/附近图层盖住 */
export function bringStreetBrowseLayersToTop(map: Map) {
  if (!map.getLayer(STREET_BROWSE_SYMBOL_LAYER)) return
  try {
    map.moveLayer(STREET_BROWSE_SYMBOL_LAYER)
    if (map.getLayer(STREET_BROWSE_HIT_TOP_LAYER)) {
      map.moveLayer(STREET_BROWSE_HIT_TOP_LAYER)
    }
  } catch {
    /* style 重建等情况下忽略 */
  }
}

export function removeStreetBrowseOverlay(map: Map) {
  if (!map.isStyleLoaded()) return
  if (map.getLayer(STREET_BROWSE_HIT_TOP_LAYER)) map.removeLayer(STREET_BROWSE_HIT_TOP_LAYER)
  if (map.getLayer(STREET_BROWSE_SYMBOL_LAYER)) map.removeLayer(STREET_BROWSE_SYMBOL_LAYER)
  if (map.getLayer(STREET_BROWSE_LINE_LAYER)) map.removeLayer(STREET_BROWSE_LINE_LAYER)
  if (map.getSource(STREET_BROWSE_SOURCE)) map.removeSource(STREET_BROWSE_SOURCE)

  if (map.getLayer(REGION_BROWSE_LINE_LAYER)) map.removeLayer(REGION_BROWSE_LINE_LAYER)
  if (map.getLayer(REGION_BROWSE_FILL_LAYER)) map.removeLayer(REGION_BROWSE_FILL_LAYER)
  if (map.getSource(REGION_BROWSE_SOURCE)) map.removeSource(REGION_BROWSE_SOURCE)
}
