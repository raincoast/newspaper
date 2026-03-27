"use client"

import type { GeoJSONSource, Map } from "maplibre-gl"
import type { ApartmentGroupOverlay, HouseMarkerDTO } from "./types"

const SOURCE_ID = "house-marker-source"
const CIRCLE_LAYER_ID = "house-marker-circle-layer"
const TEXT_LAYER_ID = "house-marker-text-layer"
const CONFLICT_LINE_SOURCE_ID = "house-marker-conflict-line-source"
const CONFLICT_LINE_LAYER_ID = "house-marker-conflict-line-layer"
const APARTMENT_SOURCE_ID = "apartment-group-source"
const APARTMENT_BORDER_LAYER_ID = "apartment-group-border-layer"
const APARTMENT_LABEL_LAYER_ID = "apartment-group-label-layer"
const NEARBY_SOURCE_ID = "house-marker-nearby-source"
const NEARBY_CIRCLE_LAYER_ID = "house-marker-nearby-circle-layer"

function toFeatureCollection(markers: HouseMarkerDTO[]) {
  return {
    type: "FeatureCollection" as const,
    features: markers.map((m) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [m.lng, m.lat]
      },
      properties: {
        id: m.id,
        number: m.current_housenumber,
        label: m.display_label,
        status: m.delivery_status,
        is_conflict: m.is_conflict
      }
    }))
  }
}

export function upsertHouseMarkerLayer(map: Map, markers: HouseMarkerDTO[]) {
  const data = toFeatureCollection(markers)

  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
  if (!source) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data
    })

    map.addLayer({
      id: CIRCLE_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "case",
          ["==", ["get", "is_conflict"], true],
          22,
          16
        ],
        "circle-color": [
          "case",
          ["==", ["get", "is_conflict"], true],
          "#ffffff",
          [
            "match",
            ["get", "status"],
            "delivered",
            "#16a34a",
            "blocked",
            "#dc2626",
            "#111111"
          ]
        ],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": [
          "case",
          ["==", ["get", "is_conflict"], true],
          "#dc2626",
          "#ffffff"
        ]
      }
    })

    map.addLayer({
      id: TEXT_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "text-field": ["to-string", ["get", "label"]],
        "text-size": [
          "case",
          ["==", ["get", "is_conflict"], true],
          14,
          13
        ]
      },
      paint: {
        "text-color": [
          "case",
          ["==", ["get", "is_conflict"], true],
          "#dc2626",
          "#ffffff"
        ]
      }
    })
  } else {
    source.setData(data)
  }
}

export function upsertApartmentGroupLayer(
  map: Map,
  groups: ApartmentGroupOverlay[]
) {
  const pad = 0.00008
  const polygonFeatures = groups.map((g) => ({
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [[
        [g.minLng - pad, g.minLat - pad],
        [g.maxLng + pad, g.minLat - pad],
        [g.maxLng + pad, g.maxLat + pad],
        [g.minLng - pad, g.maxLat + pad],
        [g.minLng - pad, g.minLat - pad]
      ]]
    },
    properties: {
      id: g.id,
      count: g.count
    }
  }))

  const labelFeatures = groups.map((g) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [g.centerLng, g.maxLat + 0.00011]
    },
    properties: {
      id: g.id,
      text: String(g.count)
    }
  }))

  const data = {
    type: "FeatureCollection" as const,
    features: polygonFeatures
  }
  const labelData = {
    type: "FeatureCollection" as const,
    features: labelFeatures
  }

  const source = map.getSource(APARTMENT_SOURCE_ID) as GeoJSONSource | undefined
  if (!source) {
    map.addSource(APARTMENT_SOURCE_ID, {
      type: "geojson",
      data
    })

    map.addLayer(
      {
        id: APARTMENT_BORDER_LAYER_ID,
        type: "line",
        source: APARTMENT_SOURCE_ID,
        paint: {
          "line-color": "#2563eb",
          "line-width": 2,
          "line-dasharray": [2, 2]
        }
      },
      CIRCLE_LAYER_ID
    )
  } else {
    source.setData(data)
  }

  const labelSource = map.getSource(`${APARTMENT_SOURCE_ID}-label`) as
    | GeoJSONSource
    | undefined
  if (!labelSource) {
    map.addSource(`${APARTMENT_SOURCE_ID}-label`, {
      type: "geojson",
      data: labelData
    })
    map.addLayer(
      {
        id: APARTMENT_LABEL_LAYER_ID,
        type: "symbol",
        source: `${APARTMENT_SOURCE_ID}-label`,
        layout: {
          "text-field": ["to-string", ["get", "text"]],
          "text-size": 12
        },
        paint: {
          "text-color": "#2563eb",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
        }
      },
      CIRCLE_LAYER_ID
    )
  } else {
    labelSource.setData(labelData)
  }
}

export function upsertConflictConnectionLayer(
  map: Map,
  lineFeatures: Array<{
    id: string
    coordinates: [number, number][]
  }>
) {
  const data = {
    type: "FeatureCollection" as const,
    features: lineFeatures.map((f) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: f.coordinates
      },
      properties: { id: f.id }
    }))
  }

  const source = map.getSource(CONFLICT_LINE_SOURCE_ID) as GeoJSONSource | undefined
  if (!source) {
    map.addSource(CONFLICT_LINE_SOURCE_ID, {
      type: "geojson",
      data
    })
    map.addLayer({
      id: CONFLICT_LINE_LAYER_ID,
      type: "line",
      source: CONFLICT_LINE_SOURCE_ID,
      paint: {
        "line-color": "#dc2626",
        "line-width": 2,
        "line-dasharray": [2, 2]
      }
    })
  } else {
    source.setData(data)
  }
}

function toNearbyFeatureCollection(markers: HouseMarkerDTO[]) {
  return {
    type: "FeatureCollection" as const,
    features: markers.map((m) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [m.lng, m.lat] },
      properties: {
        id: m.id,
        status: m.delivery_status,
        is_conflict: m.is_conflict
      }
    }))
  }
}

export function upsertNearbyHouseMarkerLayer(map: Map, markers: HouseMarkerDTO[]) {
  if (markers.length === 0) {
    if (map.getLayer(NEARBY_CIRCLE_LAYER_ID)) map.removeLayer(NEARBY_CIRCLE_LAYER_ID)
    if (map.getSource(NEARBY_SOURCE_ID)) map.removeSource(NEARBY_SOURCE_ID)
    return
  }

  const data = toNearbyFeatureCollection(markers)
  const source = map.getSource(NEARBY_SOURCE_ID) as GeoJSONSource | undefined

  if (!source) {
    map.addSource(NEARBY_SOURCE_ID, { type: "geojson", data })
    map.addLayer(
      {
        id: NEARBY_CIRCLE_LAYER_ID,
        type: "circle",
        source: NEARBY_SOURCE_ID,
        paint: {
          "circle-radius": ["case", ["==", ["get", "is_conflict"], true], 34, 28],
          "circle-color": [
            "case",
            ["==", ["get", "is_conflict"], true],
            "#ffffff",
            ["match", ["get", "status"], "delivered", "#16a34a", "blocked", "#dc2626", "#111111"]
          ],
          "circle-stroke-width": ["case", ["==", ["get", "is_conflict"], true], 3, 3],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "is_conflict"], true],
            "#dc2626",
            "#2563eb"
          ],
          "circle-stroke-opacity": 1
        }
      },
      TEXT_LAYER_ID
    )
  } else {
    source.setData(data)
  }
}

export function bindHouseMarkerClick(
  map: Map,
  onMarkerClick: (markerId: string) => void
) {
  const mapAny = map as any

  if (!mapAny._houseMarkerClickBound) {
    map.on("click", CIRCLE_LAYER_ID, (event) => {
      const feature = event.features?.[0]
      const markerId = String(feature?.properties?.id ?? "")
      if (!markerId) return
      onMarkerClick(markerId)
    })

    map.on("mouseenter", CIRCLE_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer"
    })
    map.on("mouseleave", CIRCLE_LAYER_ID, () => {
      map.getCanvas().style.cursor = ""
    })

    mapAny._houseMarkerClickBound = true
  }

  if (map.getLayer(NEARBY_CIRCLE_LAYER_ID) && !mapAny._nearbyHouseMarkerClickBound) {
    map.on("click", NEARBY_CIRCLE_LAYER_ID, (event) => {
      const feature = event.features?.[0]
      const markerId = String(feature?.properties?.id ?? "")
      if (!markerId) return
      onMarkerClick(markerId)
    })
    map.on("mouseenter", NEARBY_CIRCLE_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer"
    })
    map.on("mouseleave", NEARBY_CIRCLE_LAYER_ID, () => {
      map.getCanvas().style.cursor = ""
    })
    mapAny._nearbyHouseMarkerClickBound = true
  }
}

export function removeHouseMarkerLayer(map: Map) {
  if (map.getLayer(NEARBY_CIRCLE_LAYER_ID)) map.removeLayer(NEARBY_CIRCLE_LAYER_ID)
  if (map.getSource(NEARBY_SOURCE_ID)) map.removeSource(NEARBY_SOURCE_ID)
  if (map.getLayer(APARTMENT_LABEL_LAYER_ID)) map.removeLayer(APARTMENT_LABEL_LAYER_ID)
  if (map.getSource(`${APARTMENT_SOURCE_ID}-label`)) map.removeSource(`${APARTMENT_SOURCE_ID}-label`)
  if (map.getLayer(APARTMENT_BORDER_LAYER_ID)) map.removeLayer(APARTMENT_BORDER_LAYER_ID)
  if (map.getSource(APARTMENT_SOURCE_ID)) map.removeSource(APARTMENT_SOURCE_ID)
  if (map.getLayer(CONFLICT_LINE_LAYER_ID)) map.removeLayer(CONFLICT_LINE_LAYER_ID)
  if (map.getSource(CONFLICT_LINE_SOURCE_ID)) map.removeSource(CONFLICT_LINE_SOURCE_ID)
  if (map.getLayer(TEXT_LAYER_ID)) map.removeLayer(TEXT_LAYER_ID)
  if (map.getLayer(CIRCLE_LAYER_ID)) map.removeLayer(CIRCLE_LAYER_ID)
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
}

