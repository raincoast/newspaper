"use client"

import type { ExpressionSpecification, GeoJSONSource, Map, MapLayerMouseEvent } from "maplibre-gl"
import type { ApartmentGroupOverlay, HouseMarkerDTO } from "./types"

/** 区域编辑多边形需叠放在门牌圆点下方 */
export const HOUSE_MARKER_BEFORE_LAYER_ID = "house-marker-circle-layer"

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
const NEARBY_TEXT_LAYER_ID = "house-marker-nearby-text-layer"

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
        is_conflict: m.is_conflict,
        is_focus: m.is_delivery_focus
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
          ["==", ["get", "is_focus"], true],
          30,
          ["==", ["get", "is_conflict"], true],
          26,
          24
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
        "circle-stroke-width": [
          "case",
          ["==", ["get", "is_conflict"], true],
          2,
          ["==", ["get", "is_focus"], true],
          2.5,
          1.5
        ],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "is_conflict"], true],
          "#dc2626",
          ["==", ["get", "is_focus"], true],
          "#facc15",
          "#ffffff"
        ]
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
        ] as ExpressionSpecification,
        "text-size": 13,
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true
      },
      paint: {
        "text-color": "#ffffff"
      }
    })
  } else {
    source.setData(data)
  }
}

/** 不再绘制公寓聚合蓝色虚线框（需求移除） */
export function upsertApartmentGroupLayer(
  map: Map,
  _groups: ApartmentGroupOverlay[]
) {
  void _groups
  if (map.getLayer(APARTMENT_LABEL_LAYER_ID)) map.removeLayer(APARTMENT_LABEL_LAYER_ID)
  if (map.getSource(`${APARTMENT_SOURCE_ID}-label`)) map.removeSource(`${APARTMENT_SOURCE_ID}-label`)
  if (map.getLayer(APARTMENT_BORDER_LAYER_ID)) map.removeLayer(APARTMENT_BORDER_LAYER_ID)
  if (map.getSource(APARTMENT_SOURCE_ID)) map.removeSource(APARTMENT_SOURCE_ID)
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
        is_conflict: m.is_conflict,
        is_focus: false
      }
    }))
  }
}

export function upsertNearbyHouseMarkerLayer(map: Map, markers: HouseMarkerDTO[]) {
  if (markers.length === 0) {
    if (map.getLayer(NEARBY_TEXT_LAYER_ID)) map.removeLayer(NEARBY_TEXT_LAYER_ID)
    if (map.getLayer(NEARBY_CIRCLE_LAYER_ID)) map.removeLayer(NEARBY_CIRCLE_LAYER_ID)
    if (map.getSource(NEARBY_SOURCE_ID)) map.removeSource(NEARBY_SOURCE_ID)
    ;(map as unknown as { _nearbyHouseMarkerClickBound?: boolean })._nearbyHouseMarkerClickBound =
      false
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
          "circle-radius": ["case", ["==", ["get", "is_conflict"], true], 26, 24],
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
          "circle-stroke-width": ["case", ["==", ["get", "is_conflict"], true], 2.5, 2.5],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "is_conflict"], true],
            "#dc2626",
            "#2563eb"
          ]
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
          ] as ExpressionSpecification,
          "text-size": 13,
          "text-anchor": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true
        },
        paint: {
          "text-color": "#ffffff"
        }
      },
      TEXT_LAYER_ID
    )
  } else {
    source.setData(data)
  }
}

function ensureDelegatedHandlers(map: Map) {
  const mapAny = map as any
  if (mapAny._houseMarkerDelegatedClick) return

  mapAny._houseMarkerDelegatedClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    const markerId = String(feature?.properties?.id ?? "")
    if (!markerId) return
    const cb = mapAny._houseMarkerClickLatest as ((id: string) => void) | undefined
    cb?.(markerId)
  }

  mapAny._houseMarkerDelegatedEnter = () => {
    map.getCanvas().style.cursor = "pointer"
  }
  mapAny._houseMarkerDelegatedLeave = () => {
    map.getCanvas().style.cursor = ""
  }
}

/** 每次调用都会更新实际回调；地图事件只注册一次，避免闭包陈旧导致点击无响应 */
export function bindHouseMarkerClick(map: Map, onMarkerClick: (markerId: string) => void) {
  const mapAny = map as any
  mapAny._houseMarkerClickLatest = onMarkerClick
  ensureDelegatedHandlers(map)

  const delegated = mapAny._houseMarkerDelegatedClick as (e: MapLayerMouseEvent) => void
  const enter = mapAny._houseMarkerDelegatedEnter as () => void
  const leave = mapAny._houseMarkerDelegatedLeave as () => void

  const mainLayers = [CIRCLE_LAYER_ID, TEXT_LAYER_ID]

  if (!mapAny._houseMarkerClickBound) {
    for (const layerId of mainLayers) {
      map.on("click", layerId, delegated)
      map.on("mouseenter", layerId, enter)
      map.on("mouseleave", layerId, leave)
    }
    mapAny._houseMarkerClickBound = true
  }

  if (map.getLayer(NEARBY_CIRCLE_LAYER_ID) && !mapAny._nearbyHouseMarkerClickBound) {
    for (const layerId of [NEARBY_CIRCLE_LAYER_ID, NEARBY_TEXT_LAYER_ID]) {
      if (!map.getLayer(layerId)) continue
      map.on("click", layerId, delegated)
      map.on("mouseenter", layerId, enter)
      map.on("mouseleave", layerId, leave)
    }
    mapAny._nearbyHouseMarkerClickBound = true
  }
}

export function removeHouseMarkerLayer(map: Map) {
  if (map.getLayer(NEARBY_TEXT_LAYER_ID)) map.removeLayer(NEARBY_TEXT_LAYER_ID)
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
