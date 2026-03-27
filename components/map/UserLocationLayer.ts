"use client"

import type { GeoJSONSource, Map } from "maplibre-gl"

type UserLocation = {
  lat: number
  lng: number
  accuracy?: number | null
}

const USER_SOURCE_ID = "user-location-source"
const USER_DOT_LAYER_ID = "user-location-dot-layer"
const USER_ACCURACY_LAYER_ID = "user-location-accuracy-layer"

function metersPerPixelAtLat(lat: number, zoom: number) {
  // https://wiki.openstreetmap.org/wiki/Zoom_levels
  // Approx meters per pixel at given latitude
  const latRad = (lat * Math.PI) / 180
  const cos = Math.cos(latRad)
  return (156543.03392 * cos) / Math.pow(2, zoom)
}

export function upsertUserLocationLayer(
  map: Map,
  loc: UserLocation,
  showAccuracy: boolean
) {
  const data = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [loc.lng, loc.lat] },
        properties: {}
      }
    ]
  }

  const source = map.getSource(USER_SOURCE_ID) as GeoJSONSource | undefined
  if (!source) {
    map.addSource(USER_SOURCE_ID, { type: "geojson", data })

    map.addLayer({
      id: USER_DOT_LAYER_ID,
      type: "circle",
      source: USER_SOURCE_ID,
      paint: {
        "circle-radius": 10,
        "circle-color": "#2563eb",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff"
      }
    })

    map.addLayer({
      id: USER_ACCURACY_LAYER_ID,
      type: "circle",
      source: USER_SOURCE_ID,
      paint: {
        "circle-radius": 1,
        "circle-color": "#2563eb",
        "circle-opacity": 0.15,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#2563eb",
        "circle-stroke-opacity": 0.4
      }
    })
  } else {
    source.setData(data)
  }

  if (!showAccuracy || !loc.accuracy || loc.accuracy <= 0) {
    if (map.getLayer(USER_ACCURACY_LAYER_ID)) {
      map.setPaintProperty(USER_ACCURACY_LAYER_ID, "circle-radius", 0)
      map.setLayoutProperty(USER_ACCURACY_LAYER_ID, "visibility", "none")
    }
    return
  }

  const zoom = map.getZoom()
  const mpp = metersPerPixelAtLat(loc.lat, zoom)
  const radiusPx = Math.max(1, Math.min(120, loc.accuracy / mpp))

  if (map.getLayer(USER_ACCURACY_LAYER_ID)) {
    map.setLayoutProperty(USER_ACCURACY_LAYER_ID, "visibility", "visible")
    map.setPaintProperty(USER_ACCURACY_LAYER_ID, "circle-radius", radiusPx)
  }
}

export function removeUserLocationLayer(map: Map) {
  if (map.getLayer(USER_ACCURACY_LAYER_ID))
    map.removeLayer(USER_ACCURACY_LAYER_ID)
  if (map.getLayer(USER_DOT_LAYER_ID)) map.removeLayer(USER_DOT_LAYER_ID)
  if (map.getSource(USER_SOURCE_ID)) map.removeSource(USER_SOURCE_ID)
}

