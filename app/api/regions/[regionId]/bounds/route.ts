import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { isDeliveryStaff } from "../../../../../lib/api/deliveryStaff"
import { prisma } from "../../../../../lib/prisma/client"

type RingPoint = { lng: number; lat: number }

function normalizeRing(raw: unknown): RingPoint[] | null {
  if (raw === null) return null
  if (!Array.isArray(raw) || raw.length !== 4) return null
  const out: RingPoint[] = []
  for (const p of raw) {
    if (!p || typeof p !== "object") return null
    const lng = Number((p as RingPoint).lng)
    const lat = Number((p as RingPoint).lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
    if (lng < -180 || lng > 180 || lat < -85 || lat > 85) return null
    out.push({ lng, lat })
  }
  return out
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { regionId: string } }
) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isDeliveryStaff(token.role as string | undefined)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    mapBoundsRing?: unknown
  } | null

  const ring = normalizeRing(body?.mapBoundsRing ?? undefined)
  if (body && "mapBoundsRing" in (body || {}) && body.mapBoundsRing !== null && !ring) {
    return NextResponse.json({ error: "Invalid mapBoundsRing" }, { status: 400 })
  }

  const nextRing = body?.mapBoundsRing === null ? null : ring ?? undefined
  if (nextRing === undefined) {
    return NextResponse.json({ error: "mapBoundsRing required" }, { status: 400 })
  }

  const updated = await prisma.region.update({
    where: { id: params.regionId },
    data: {
      mapBoundsRing:
        nextRing === null
          ? Prisma.DbNull
          : (nextRing as unknown as Prisma.InputJsonValue)
    }
  })

  return NextResponse.json({
    region: {
      id: updated.id,
      name: updated.name,
      mapBoundsRing: updated.mapBoundsRing as RingPoint[] | null
    }
  })
}
