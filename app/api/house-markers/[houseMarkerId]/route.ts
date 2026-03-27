import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../lib/prisma/client"

function canWriteAction(action: unknown): action is "remove_from_plan" | "update_housenumber" {
  return action === "remove_from_plan" || action === "update_housenumber"
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

  if (token.role !== "admin") {
    const assignment = await prisma.userRegionAssignment.findUnique({
      where: { userId_regionId: { userId: token.sub, regionId: marker.regionId } }
    })
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown
        new_housenumber?: string
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

