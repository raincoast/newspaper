import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { isPublicDemoRegion } from "../../../lib/api/regionAccess"
import { prisma } from "../../../lib/prisma/client"

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  const { searchParams } = new URL(request.url)
  const regionId = searchParams.get("regionId")
  if (!regionId) return NextResponse.json({ error: "regionId required" }, { status: 400 })

  if (!token?.sub) {
    const pub = await isPublicDemoRegion(regionId)
    if (!pub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  } else if (token.role !== "admin") {
    const assignment = await prisma.userRegionAssignment.findUnique({
      where: { userId_regionId: { userId: token.sub, regionId } }
    })
    const pub = await isPublicDemoRegion(regionId)
    if (!assignment && !pub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const regionRow = await prisma.region.findUnique({
    where: { id: regionId },
    select: { deliveryFocusHouseMarkerId: true }
  })
  const focusId = regionRow?.deliveryFocusHouseMarkerId ?? null

  const markers = await prisma.houseMarker.findMany({
    where: {
      regionId,
      is_manually_excluded: false
    },
    orderBy: [{ street_name: "asc" }, { current_housenumber: "asc" }],
    select: {
      id: true,
      street_name: true,
      current_housenumber: true,
      osm_default_housenumber: true,
      delivery_status: true,
      last_delivered_at: true,
      last_delivery_update_at: true,
      lat: true,
      lng: true,
      is_selected_by_rule: true,
      is_manually_excluded: true,
      building_id: true,
      apartment_group_id: true
    }
  })

  // 冲突规则：同一区域 + 同街道 + 相同 current_housenumber
  const groups = new Map<string, typeof markers>()
  for (const m of markers) {
    const key = `${m.street_name}__${m.current_housenumber}`
    const arr = groups.get(key) ?? []
    arr.push(m)
    groups.set(key, arr)
  }

  const conflictMap = new Map<string, { is_conflict: boolean; peerIds: string[] }>()
  for (const arr of groups.values()) {
    if (arr.length < 2) continue
    for (const m of arr) {
      conflictMap.set(m.id, {
        is_conflict: true,
        peerIds: arr.filter((x) => x.id !== m.id).map((x) => x.id)
      })
    }
  }

  const markerDtos = markers.map((m) => ({
    ...m,
    display_label: conflictMap.get(m.id)?.is_conflict
      ? `${m.current_housenumber} (OSM:${m.osm_default_housenumber})`
      : m.current_housenumber,
    delivery_status:
      m.delivery_status === "NO_ADVERTISE"
        ? "blocked"
        : m.last_delivered_at && isSameDay(new Date(m.last_delivered_at), new Date())
          ? "delivered"
          : "pending",
    is_conflict: Boolean(conflictMap.get(m.id)?.is_conflict),
    conflict_peer_ids: conflictMap.get(m.id)?.peerIds ?? [],
    is_delivery_focus: m.id === focusId
  }))

  // 公寓/建筑聚合：优先 apartment_group_id，否则 building_id；仅对 2+ 门牌输出
  const apartmentBuckets = new Map<
    string,
    Array<(typeof markerDtos)[number]>
  >()

  for (const m of markerDtos) {
    const aggregateId = m.apartment_group_id || m.building_id
    if (!aggregateId) continue
    const arr = apartmentBuckets.get(aggregateId) ?? []
    arr.push(m)
    apartmentBuckets.set(aggregateId, arr)
  }

  const apartment_groups = Array.from(apartmentBuckets.entries())
    .filter(([, arr]) => arr.length >= 2)
    .map(([id, arr]) => {
      const minLat = Math.min(...arr.map((x) => x.lat))
      const maxLat = Math.max(...arr.map((x) => x.lat))
      const minLng = Math.min(...arr.map((x) => x.lng))
      const maxLng = Math.max(...arr.map((x) => x.lng))
      const centerLat = (minLat + maxLat) / 2
      const centerLng = (minLng + maxLng) / 2

      return {
        id,
        count: arr.length,
        minLat,
        maxLat,
        minLng,
        maxLng,
        centerLat,
        centerLng
      }
    })

  return NextResponse.json({
    markers: markerDtos,
    apartment_groups,
    deliveryFocusHouseMarkerId: focusId
  })
}

