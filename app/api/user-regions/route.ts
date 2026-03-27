import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../lib/prisma/client"

/**
 * 投递员/管理员自行将当前账号加入某区域（无需 admin 在后台分配）。
 */
export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { regionId?: string } | null
  const regionId = body?.regionId?.trim()
  if (!regionId) {
    return NextResponse.json({ error: "regionId required" }, { status: 400 })
  }

  const region = await prisma.region.findUnique({ where: { id: regionId }, select: { id: true } })
  if (!region) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.userRegionAssignment.upsert({
    where: {
      userId_regionId: {
        userId: token.sub,
        regionId
      }
    },
    create: { userId: token.sub, regionId },
    update: {}
  })

  return NextResponse.json({ ok: true })
}
