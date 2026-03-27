import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
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

async function canWriteRegion(userId: string, role: string | undefined, regionId: string) {
  if (role === "admin") return true
  const assignment = await prisma.userRegionAssignment.findUnique({
    where: { userId_regionId: { userId, regionId } }
  })
  return Boolean(assignment)
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

  const ok = await canWriteRegion(token.sub, token.role as string | undefined, params.regionId)
  if (!ok) {
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
