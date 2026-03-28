import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { isDeliveryStaff } from "../../../../../lib/api/deliveryStaff"
import { prisma } from "../../../../../lib/prisma/client"

type ClientStatus = "pending" | "delivered" | "blocked"

function toDbStatus(status: ClientStatus) {
  if (status === "delivered") return "DELIVERED"
  if (status === "blocked") return "NO_ADVERTISE"
  return "NOT_DELIVERED"
}

function isClientStatus(v: unknown): v is ClientStatus {
  return v === "pending" || v === "delivered" || v === "blocked"
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { houseMarkerId: string } }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { status?: unknown } | null
  if (!isClientStatus(body?.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const marker = await prisma.houseMarker.findUnique({
    where: { id: params.houseMarkerId },
    select: { id: true, regionId: true }
  })
  if (!marker) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isDeliveryStaff(token.role as string | undefined)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.houseMarker.update({
    where: { id: marker.id },
    data: {
      delivery_status: toDbStatus(body.status),
      last_delivery_update_at: new Date(),
      last_delivered_at:
        body.status === "delivered"
          ? new Date()
          : body.status === "pending"
            ? null
            : undefined
    }
  })

  return NextResponse.json({ ok: true })
}

