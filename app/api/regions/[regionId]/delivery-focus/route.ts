import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { isDeliveryStaff } from "../../../../../lib/api/deliveryStaff"
import { prisma } from "../../../../../lib/prisma/client"

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
    houseMarkerId?: string | null
  } | null

  const raw = body?.houseMarkerId
  if (raw === undefined) {
    return NextResponse.json({ error: "houseMarkerId required (or null)" }, { status: 400 })
  }

  if (raw === null) {
    const updated = await prisma.region.update({
      where: { id: params.regionId },
      data: { deliveryFocusHouseMarkerId: null }
    })
    return NextResponse.json({
      region: { id: updated.id, deliveryFocusHouseMarkerId: null as string | null }
    })
  }

  const houseMarkerId = String(raw).trim()
  if (!houseMarkerId) {
    return NextResponse.json({ error: "Invalid houseMarkerId" }, { status: 400 })
  }

  const hm = await prisma.houseMarker.findUnique({
    where: { id: houseMarkerId },
    select: { id: true, regionId: true }
  })
  if (!hm || hm.regionId !== params.regionId) {
    return NextResponse.json({ error: "House marker not in this region" }, { status: 400 })
  }

  const updated = await prisma.region.update({
    where: { id: params.regionId },
    data: { deliveryFocusHouseMarkerId: hm.id }
  })

  return NextResponse.json({
    region: {
      id: updated.id,
      deliveryFocusHouseMarkerId: updated.deliveryFocusHouseMarkerId
    }
  })
}
