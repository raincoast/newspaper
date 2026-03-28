import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { isDeliveryStaff } from "../../../../../lib/api/deliveryStaff"
import { prisma } from "../../../../../lib/prisma/client"

type ResetMode = "delivery_status" | "full"

function isMode(v: unknown): v is ResetMode {
  return v === "delivery_status" || v === "full"
}

/**
 * POST { mode: "delivery_status" | "full" }
 * - delivery_status：仅重置今日投递进度（已投递→未投递），保留「不让投递」与禁投姓名等
 * - full：所有门牌恢复可投递，清除不让投递、禁投姓名、从计划移除标记
 */
export async function POST(
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

  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null
  if (!isMode(body?.mode)) {
    return NextResponse.json({ error: "mode must be delivery_status or full" }, { status: 400 })
  }

  const now = new Date()
  const regionId = params.regionId

  if (body.mode === "delivery_status") {
    await prisma.houseMarker.updateMany({
      where: { regionId, delivery_status: "DELIVERED" },
      data: {
        delivery_status: "NOT_DELIVERED",
        last_delivered_at: null,
        last_delivery_update_at: now
      }
    })
  } else {
    await prisma.houseMarker.updateMany({
      where: { regionId },
      data: {
        delivery_status: "NOT_DELIVERED",
        last_delivered_at: null,
        is_manually_excluded: false,
        excluded_recipient_names: [],
        last_delivery_update_at: now
      }
    })
  }

  return NextResponse.json({ ok: true })
}
