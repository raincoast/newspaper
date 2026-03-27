"use client"

import type { ExpressionSpecification, GeoJSONSource, Map } from "maplibre-gl"
import type { ApartmentGroupOverlay, HouseMarkerDTO } from "./types"

export const HOUSE_MARKER_BEFORE_LAYER_ID = "house-marker-icon-layer"

const SOURCE_ID = "house-marker-source"
const ICON_LAYER_ID = "house-marker-icon-layer"
const TEXT_LAYER_ID = "house-marker-text-layer"
const CONFLICT_LINE_SOURCE_ID = "house-marker-conflict-line-source"
const CONFLICT_LINE_LAYER_ID = "house-marker-conflict-line-layer"
const APARTMENT_SOURCE_ID = "apartment-group-source"
const APARTMENT_BORDER_LAYER_ID = "apartment-group-border-layer"
const APARTMENT_LABEL_LAYER_ID = "apartment-group-label-layer"
const NEARBY_SOURCE_ID = "house-marker-nearby-source"
const NEARBY_ICON_LAYER_ID = "house-marker-nearby-icon-layer"
const NEARBY_TEXT_LAYER_ID = "house-marker-nearby-text-layer"

const IMG_PENDING = "house-mk-pending"
const IMG_DELIVERED = "house-mk-delivered"
const IMG_BLOCKED = "house-mk-blocked"
const IMG_CONFLICT = "house-mk-conflict"

const imagesLoadedByMap = new WeakMap<Map, Promise<void>>()

function drawRoundedRectIcon(
  fill: string,
  stroke: string,
  width = 64,
  height = 36,
  radius = 9
): string {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas.toDataURL()
  ctx.clearRect(0, 0, width, height)
  ctx.beginPath()
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(1.5, 1.5, width - 3, height - 3, radius)
  } else {
    ctx.rect(1.5, 1.5, width - 3, height - 3)
  }
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1.5
  ctx.stroke()
  return canvas.toDataURL()
}

function loadDataUrlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("marker image load failed"))
    img.src = url
  })
}

export function ensureHouseMarkerImages(map: Map): Promise<void> {
  const existing = imagesLoadedByMap.get(map)
  if (existing) return existing

  const loading = (async () => {
    const specs: Array<[string, string, string]> = [
      [IMG_PENDING, "#111111", "#ffffff"],
      [IMG_DELIVERED, "#16a34a", "#ffffff"],
      [IMG_BLOCKED, "#dc2626", "#ffffff"],
      [IMG_CONFLICT, "#ffffff", "#dc2626"]
    ]

    for (const [id, fill, stroke] of specs) {
      if (map.hasImage(id)) continue
      const url = drawRoundedRectIcon(fill, stroke)
      const img = await loadDataUrlImage(url)
      map.addImage(id, img, { pixelRatio: 2 })
    }
  })()

  imagesLoadedByMap.set(map, loading)
  return loading
}

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

export async function upsertHouseMarkerLayer(map: Map, markers: HouseMarkerDTO[]) {
  await ensureHouseMarkerImages(map)

  const data = toFeatureCollection(markers)
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined

  const iconImageExpr: ExpressionSpecification = [
    "case",
    ["==", ["get", "is_conflict"], true],
    IMG_CONFLICT,
    [
      "match",
      ["get", "status"],
      "delivered",
      IMG_DELIVERED,
      "blocked",
      IMG_BLOCKED,
      IMG_PENDING
    ]
  ]

  if (!source) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data
    })

    map.addLayer({
      id: ICON_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "icon-image": iconImageExpr,
        "icon-size": 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-anchor": "center"
      }
    })

    map.addLayer({
      id: TEXT_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "text-field": [
          "case",
          ["==", ["get", "is_conflict"], true],
          ["to-string", ["get", "label"]],
          ["to-string", ["get", "number"]]
        ],
        "text-size": 12,
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-offset": [0, 0]
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
      ICON_LAYER_ID
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
      ICON_LAYER_ID
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
        number: m.current_housenumber,
        label: m.display_label,
        status: m.delivery_status,
        is_conflict: m.is_conflict
      }
    }))
  }
}

export async function upsertNearbyHouseMarkerLayer(map: Map, markers: HouseMarkerDTO[]) {
  await ensureHouseMarkerImages(map)

  if (markers.length === 0) {
    if (map.getLayer(NEARBY_TEXT_LAYER_ID)) map.removeLayer(NEARBY_TEXT_LAYER_ID)
    if (map.getLayer(NEARBY_ICON_LAYER_ID)) map.removeLayer(NEARBY_ICON_LAYER_ID)
    if (map.getSource(NEARBY_SOURCE_ID)) map.removeSource(NEARBY_SOURCE_ID)
    ;(map as unknown as { _nearbyHouseMarkerClickBound?: boolean })._nearbyHouseMarkerClickBound =
      false
    return
  }

  const data = toNearbyFeatureCollection(markers)
  const nearbyIconExpr: ExpressionSpecification = [
    "case",
    ["==", ["get", "is_conflict"], true],
    IMG_CONFLICT,
    [
      "match",
      ["get", "status"],
      "delivered",
      IMG_DELIVERED,
      "blocked",
      IMG_BLOCKED,
      IMG_PENDING
    ]
  ]

  const source = map.getSource(NEARBY_SOURCE_ID) as GeoJSONSource | undefined

  if (!source) {
    map.addSource(NEARBY_SOURCE_ID, { type: "geojson", data })
    map.addLayer(
      {
        id: NEARBY_ICON_LAYER_ID,
        type: "symbol",
        source: NEARBY_SOURCE_ID,
        layout: {
          "icon-image": nearbyIconExpr,
          "icon-size": 1.25,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true
        }
      },
      TEXT_LAYER_ID
    )
    map.addLayer(
      {
        id: NEARBY_TEXT_LAYER_ID,
        type: "symbol",
        source: NEARBY_SOURCE_ID,
        layout: {
          "text-field": [
            "case",
            ["==", ["get", "is_conflict"], true],
            ["to-string", ["get", "label"]],
            ["to-string", ["get", "number"]]
          ],
          "text-size": 13,
          "text-anchor": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true
        },
        paint: {
          "text-color": [
            "case",
            ["==", ["get", "is_conflict"], true],
            "#dc2626",
            "#ffffff"
          ]
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

  const layerIds = [ICON_LAYER_ID, TEXT_LAYER_ID]

  if (!mapAny._houseMarkerClickBound) {
    for (const layerId of layerIds) {
      map.on("click", layerId, (event) => {
        const feature = event.features?.[0]
        const markerId = String(feature?.properties?.id ?? "")
        if (!markerId) return
        onMarkerClick(markerId)
      })
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer"
      })
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = ""
      })
    }
    mapAny._houseMarkerClickBound = true
  }

  if (map.getLayer(NEARBY_ICON_LAYER_ID) && !mapAny._nearbyHouseMarkerClickBound) {
    for (const layerId of [NEARBY_ICON_LAYER_ID, NEARBY_TEXT_LAYER_ID]) {
      if (!map.getLayer(layerId)) continue
      map.on("click", layerId, (event) => {
        const feature = event.features?.[0]
        const markerId = String(feature?.properties?.id ?? "")
        if (!markerId) return
        onMarkerClick(markerId)
      })
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer"
      })
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = ""
      })
    }
    mapAny._nearbyHouseMarkerClickBound = true
  }
}

export function removeHouseMarkerLayer(map: Map) {
  if (map.getLayer(NEARBY_TEXT_LAYER_ID)) map.removeLayer(NEARBY_TEXT_LAYER_ID)
  if (map.getLayer(NEARBY_ICON_LAYER_ID)) map.removeLayer(NEARBY_ICON_LAYER_ID)
  if (map.getSource(NEARBY_SOURCE_ID)) map.removeSource(NEARBY_SOURCE_ID)
  if (map.getLayer(APARTMENT_LABEL_LAYER_ID)) map.removeLayer(APARTMENT_LABEL_LAYER_ID)
  if (map.getSource(`${APARTMENT_SOURCE_ID}-label`)) map.removeSource(`${APARTMENT_SOURCE_ID}-label`)
  if (map.getLayer(APARTMENT_BORDER_LAYER_ID)) map.removeLayer(APARTMENT_BORDER_LAYER_ID)
  if (map.getSource(APARTMENT_SOURCE_ID)) map.removeSource(APARTMENT_SOURCE_ID)
  if (map.getLayer(CONFLICT_LINE_LAYER_ID)) map.removeLayer(CONFLICT_LINE_LAYER_ID)
  if (map.getSource(CONFLICT_LINE_SOURCE_ID)) map.removeSource(CONFLICT_LINE_SOURCE_ID)
  if (map.getLayer(TEXT_LAYER_ID)) map.removeLayer(TEXT_LAYER_ID)
  if (map.getLayer(ICON_LAYER_ID)) map.removeLayer(ICON_LAYER_ID)
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
}
