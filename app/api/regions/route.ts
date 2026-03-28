import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../lib/prisma/client"

function serializeRegion(r: {
  id: string
  name: string
  mapBoundsRing: unknown
}) {
  return {
    id: r.id,
    name: r.name,
    mapBoundsRing: (r.mapBoundsRing ?? null) as
      | { lng: number; lat: number }[]
      | null
  }
}

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  if (!token?.sub) {
    const demo = await prisma.region.findMany({
      where: { isPublicDemo: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, mapBoundsRing: true }
    })
    return NextResponse.json({
      regions: demo.map(serializeRegion)
    })
  }

  const manage = request.nextUrl.searchParams.get("manage") === "1"
  const role = token.role as string | undefined

  if (manage && role === "courier") {
    const all = await prisma.region.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, mapBoundsRing: true }
    })
    const mine = await prisma.userRegionAssignment.findMany({
      where: { userId: token.sub },
      select: { regionId: true }
    })
    const set = new Set(mine.map((m) => m.regionId))
    return NextResponse.json({
      regions: all.map((r) => ({
        ...serializeRegion(r),
        assigned: set.has(r.id)
      }))
    })
  }

  if (manage && role === "admin") {
    const all = await prisma.region.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, mapBoundsRing: true }
    })
    return NextResponse.json({
      regions: all.map((r) => ({
        ...serializeRegion(r),
        assigned: true
      }))
    })
  }

  const regions =
    role === "admin" || role === "courier"
      ? await prisma.region.findMany({
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, mapBoundsRing: true }
        })
      : await prisma.region.findMany({
          where: { userAssignments: { some: { userId: token.sub } } },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, mapBoundsRing: true }
        })

  return NextResponse.json({
    regions: regions.map(serializeRegion)
  })
}

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = token.role as string | undefined
  if (role !== "admin" && role !== "courier") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as
    | { name?: string }
    | null

  const name = body?.name?.trim()
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const region = await prisma.region.create({ data: { name } })

  await prisma.userRegionAssignment.upsert({
    where: {
      userId_regionId: {
        userId: token.sub,
        regionId: region.id
      }
    },
    create: { userId: token.sub, regionId: region.id },
    update: {}
  })

  return NextResponse.json({
    region: serializeRegion(region)
  })
}
