import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { isDeliveryStaff } from "../../../../lib/api/deliveryStaff"
import { prisma } from "../../../../lib/prisma/client"

export async function PUT(
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

  const body = (await request.json().catch(() => null)) as
    | { name?: string }
    | null

  const name = body?.name?.trim()
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const updated = await prisma.region.update({
    where: { id: params.regionId },
    data: { name }
  })

  return NextResponse.json({
    region: { id: updated.id, name: updated.name }
  })
}

export async function DELETE(
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

  await prisma.$transaction(async (tx) => {
    await tx.userRegionAssignment.deleteMany({ where: { regionId: params.regionId } })
    await tx.region.delete({ where: { id: params.regionId } })
  })

  return NextResponse.json({ ok: true })
}

