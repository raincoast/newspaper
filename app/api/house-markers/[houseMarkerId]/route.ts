import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { isDeliveryStaff } from "../../../../lib/api/deliveryStaff"
import { prisma } from "../../../../lib/prisma/client"

function canWriteAction(
  action: unknown
): action is "remove_from_plan" | "update_housenumber" | "update_excluded_recipient_names" {
  return (
    action === "remove_from_plan" ||
    action === "update_housenumber" ||
    action === "update_excluded_recipient_names"
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { houseMarkerId: string } }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const marker = await prisma.houseMarker.findUnique({
    where: { id: params.houseMarkerId },
    select: {
      id: true,
      regionId: true,
      current_housenumber: true
    }
  })
  if (!marker) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isDeliveryStaff(token.role as string | undefined)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown
        new_housenumber?: string
        excluded_recipient_names?: unknown
      }
    | null

  if (!canWriteAction(body?.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  if (body.action === "remove_from_plan") {
    await prisma.houseMarker.update({
      where: { id: marker.id },
      data: {
        is_manually_excluded: true,
        is_selected_by_rule: false
      }
    })
    return NextResponse.json({ ok: true, action: "remove_from_plan" })
  }

  if (body.action === "update_excluded_recipient_names") {
    const raw = body.excluded_recipient_names
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: "excluded_recipient_names array required" },
        { status: 400 }
      )
    }
    const cleaned = raw
      .map((x) => String(x).trim())
      .filter(Boolean)
      .slice(0, 40)
    await prisma.houseMarker.update({
      where: { id: marker.id },
      data: { excluded_recipient_names: cleaned }
    })
    return NextResponse.json({ ok: true, excluded_recipient_names: cleaned })
  }

  const nextNumber = body.new_housenumber?.trim()
  if (!nextNumber) {
    return NextResponse.json({ error: "new_housenumber required" }, { status: 400 })
  }

  await prisma.houseMarker.update({
    where: { id: marker.id },
    data: {
      current_housenumber: nextNumber,
      is_number_overridden: nextNumber !== marker.current_housenumber
    }
  })

  return NextResponse.json({
    ok: true,
    action: "update_housenumber",
    current_housenumber: nextNumber
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { houseMarkerId: string } }
) {
  const token = await getToken({ req: _request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isDeliveryStaff(token.role as string | undefined)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const marker = await prisma.houseMarker.findUnique({
    where: { id: params.houseMarkerId },
    select: { id: true }
  })
  if (!marker) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    await tx.region.updateMany({
      where: { deliveryFocusHouseMarkerId: marker.id },
      data: { deliveryFocusHouseMarkerId: null }
    })
    await tx.houseMarker.delete({ where: { id: marker.id } })
  })

  return NextResponse.json({ ok: true })
}
