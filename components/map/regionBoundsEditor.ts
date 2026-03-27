"use client"

import type { FeatureCollection, Polygon } from "geojson"
import maplibregl, { type GeoJSONSource, type Map } from "maplibre-gl"
import { HOUSE_MARKER_BEFORE_LAYER_ID } from "./HouseMarkerLayer"

export type RingPoint = { lng: number; lat: number }

const SOURCE = "region-bounds-edit-source"
const FILL = "region-bounds-edit-fill"
const LINE = "region-bounds-edit-line"

function emptyFc(): FeatureCollection {
  return { type: "FeatureCollection", features: [] }
}

function defaultRing(center: maplibregl.LngLat): RingPoint[] {
  const d = 0.0011
  const { lng, lat } = center
  return [
    { lng: lng - d, lat: lat + d * 0.7 },
    { lng: lng + d, lat: lat + d * 0.7 },
    { lng: lng + d, lat: lat - d * 0.7 },
    { lng: lng - d, lat: lat - d * 0.7 }
  ]
}

export function ringToLngLatBounds(ring: RingPoint[]): maplibregl.LngLatBoundsLike {
  const lngs = ring.map((p) => p.lng)
  const lats = ring.map((p) => p.lat)
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ]
}

export class RegionBoundsEditor {
  private map: Map
  private ring: RingPoint[] | null = null
  private cornerMarkers: maplibregl.Marker[] = []
  private centerMarker: maplibregl.Marker | null = null
  private onChange: (ring: RingPoint[] | null) => void

  constructor(
    map: Map,
    initial: RingPoint[] | null,
    onChange: (ring: RingPoint[] | null) => void
  ) {
    this.map = map
    this.onChange = onChange
    if (initial && initial.length === 4) {
      this.ring = initial.map((p) => ({ lng: p.lng, lat: p.lat }))
    }
    this.ensureLayers()
    if (this.ring) {
      this.syncSource()
      this.mountHandles()
    }
  }

  private ensureLayers() {
    if (this.map.getSource(SOURCE)) return
    this.map.addSource(SOURCE, {
      type: "geojson",
      data: emptyFc()
    })
    const before =
      this.map.getLayer(HOUSE_MARKER_BEFORE_LAYER_ID) ? HOUSE_MARKER_BEFORE_LAYER_ID : undefined
    this.map.addLayer(
      {
        id: FILL,
        type: "fill",
        source: SOURCE,
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.22
        }
      },
      before
    )
    this.map.addLayer(
      {
        id: LINE,
        type: "line",
        source: SOURCE,
        paint: {
          "line-color": "#15803d",
          "line-width": 2
        }
      },
      before
    )
  }

  addRectangle() {
    if (this.ring) return
    this.ring = defaultRing(this.map.getCenter())
    this.syncSource()
    this.mountHandles()
    this.onChange(this.ring)
  }

  clearRectangle() {
    this.destroyHandles()
    this.ring = null
    this.syncSource()
    this.onChange(null)
  }

  getRing() {
    return this.ring ? this.ring.map((p) => ({ ...p })) : null
  }

  destroy() {
    this.destroyHandles()
    if (this.map.getLayer(LINE)) this.map.removeLayer(LINE)
    if (this.map.getLayer(FILL)) this.map.removeLayer(FILL)
    if (this.map.getSource(SOURCE)) this.map.removeSource(SOURCE)
  }

  private syncSource() {
    const src = this.map.getSource(SOURCE) as GeoJSONSource
    if (!this.ring) {
      src.setData(emptyFc())
      return
    }
    const c = this.ring
    const ring: [number, number][] = [
      ...c.map((p) => [p.lng, p.lat] as [number, number]),
      [c[0].lng, c[0].lat]
    ]
    const polygon: Polygon = { type: "Polygon", coordinates: [ring] }
    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: polygon }]
    }
    src.setData(fc)
  }

  private mountHandles() {
    this.destroyHandles()
    if (!this.ring) return
    for (let i = 0; i < 4; i++) {
      const el = document.createElement("div")
      el.style.width = "16px"
      el.style.height = "16px"
      el.style.borderRadius = "9999px"
      el.style.background = "#fff"
      el.style.border = "2px solid #16a34a"
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.25)"
      el.style.cursor = "grab"
      const idx = i
      const m = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([this.ring[i].lng, this.ring[i].lat])
        .addTo(this.map)
      m.on("drag", () => {
        const ll = m.getLngLat()
        if (!this.ring) return
        this.ring = [...this.ring]
        this.ring[idx] = { lng: ll.lng, lat: ll.lat }
        this.syncSource()
        this.repositionCenter()
        this.onChange(this.ring)
      })
      this.cornerMarkers.push(m)
    }

    const centerEl = document.createElement("button")
    centerEl.type = "button"
    centerEl.setAttribute("aria-label", "删除框选")
    centerEl.innerHTML =
      '<span class="material-symbols-outlined" style="font-size:20px;line-height:1">delete</span>'
    centerEl.style.display = "flex"
    centerEl.style.alignItems = "center"
    centerEl.style.justifyContent = "center"
    centerEl.style.width = "36px"
    centerEl.style.height = "36px"
    centerEl.style.borderRadius = "10px"
    centerEl.style.border = "none"
    centerEl.style.background = "rgba(255,255,255,0.95)"
    centerEl.style.boxShadow = "0 1px 6px rgba(0,0,0,0.2)"
    centerEl.style.cursor = "pointer"
    centerEl.style.color = "#b91c1c"
    centerEl.onclick = (e) => {
      e.stopPropagation()
      e.preventDefault()
      this.clearRectangle()
    }
    this.centerMarker = new maplibregl.Marker({ element: centerEl })
      .setLngLat(this.ringCenter())
      .addTo(this.map)
  }

  private ringCenter(): maplibregl.LngLatLike {
    if (!this.ring) return [0, 0]
    const lng = this.ring.reduce((s, p) => s + p.lng, 0) / 4
    const lat = this.ring.reduce((s, p) => s + p.lat, 0) / 4
    return [lng, lat]
  }

  private repositionCenter() {
    this.centerMarker?.setLngLat(this.ringCenter())
  }

  private destroyHandles() {
    for (const m of this.cornerMarkers) m.remove()
    this.cornerMarkers = []
    this.centerMarker?.remove()
    this.centerMarker = null
  }
}
