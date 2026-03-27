import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../lib/prisma/client"

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = token.role
  const userId = token.sub

  const regions =
    role === "admin"
      ? await prisma.region.findMany({ orderBy: { createdAt: "desc" } })
      : await prisma.region.findMany({
          where: { userAssignments: { some: { userId } } },
          orderBy: { createdAt: "desc" }
        })

  return NextResponse.json({
    regions: regions.map((r) => ({ id: r.id, name: r.name }))
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

  if (token.role !== "admin") {
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

  // 为管理员创建“可见”的分配记录（便于后续统一逻辑）
  await prisma.userRegionAssignment.create({
    data: { userId: token.sub, regionId: region.id }
  })

  return NextResponse.json({ region: { id: region.id, name: region.name } })
}

