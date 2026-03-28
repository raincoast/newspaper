import { NextRequest, NextResponse } from "next/server"
import type { Feature, LineString, Polygon } from "geojson"
import * as turf from "@turf/turf"

type RingPoint = { lng: number; lat: number }

const HIGHWAY_RE =
  "^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|service|track)$"

function ringToPolygon(ring: RingPoint[]) {
  const coords = ring.map((p) => [p.lng, p.lat] as [number, number])
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]])
  }
  return turf.polygon([coords])
}

function pickName(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null
  const v = tags.name || tags["name:de"] || tags["name:en"] || tags["name:latin"]
  if (typeof v !== "string" || !v.trim()) return null
  return v.trim()
}

function bboxPadded(ring: RingPoint[], pad: number) {
  const lngs = ring.map((p) => p.lng)
  const lats = ring.map((p) => p.lat)
  return {
    south: Math.min(...lats) - pad,
    west: Math.min(...lngs) - pad,
    north: Math.max(...lats) + pad,
    east: Math.max(...lngs) + pad
  }
}

/**
 * POST { ring: { lng, lat }[] } — 须为 4 点矩形（与区域编辑一致）。
 * 从 OSM 拉取 bbox 内命名道路，保留与多边形 booleanIntersects 的线段（含仅擦边）。
 */
export async function POST(request: NextRequest) {
  let body: { ring?: RingPoint[] }
  try {
    body = (await request.json()) as { ring?: RingPoint[] }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ring = body.ring
  if (!ring || !Array.isArray(ring) || ring.length !== 4) {
    return NextResponse.json({ error: "ring must be an array of 4 points" }, { status: 400 })
  }

  for (const p of ring) {
    if (
      typeof p?.lng !== "number" ||
      typeof p?.lat !== "number" ||
      !Number.isFinite(p.lng) ||
      !Number.isFinite(p.lat)
    ) {
      return NextResponse.json({ error: "invalid ring coordinates" }, { status: 400 })
    }
  }

  let poly: Feature<Polygon>
  try {
    poly = ringToPolygon(ring) as Feature<Polygon>
  } catch {
    return NextResponse.json({ error: "invalid polygon" }, { status: 400 })
  }

  const { south, west, north, east } = bboxPadded(ring, 0.00035)
  const query = `
[out:json][timeout:28];
(
  way["highway"~"${HIGHWAY_RE}"]["name"](${south},${west},${north},${east});
);
out geom;
`.trim()

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "newspaper-delivery-map/1.0 (osm-streets-in-region)"
    },
    body: `data=${encodeURIComponent(query)}`,
    next: { revalidate: 0 }
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Overpass request failed" }, { status: 502 })
  }

  const data = (await res.json()) as {
    elements?: Array<{
      type: string
      id: number
      geometry?: Array<{ lat: number; lon: number }>
      tags?: Record<string, string>
    }>
  }

  const elements = data.elements ?? []
  const features: Feature[] = []

  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue
    const name = pickName(el.tags)
    if (!name) continue
    const coords = el.geometry.map((g) => [g.lon, g.lat] as [number, number])
    let line: Feature<LineString>
    try {
      line = turf.lineString(coords, { name, way_id: el.id }) as Feature<LineString>
    } catch {
      continue
    }
    try {
      if (turf.booleanIntersects(line, poly)) {
        features.push(line)
      }
    } catch {
      /* ignore bad geom */
    }
  }

  const collection = turf.featureCollection(features)
  return NextResponse.json({ geojson: collection })
}
