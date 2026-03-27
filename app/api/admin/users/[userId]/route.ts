import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../../lib/prisma/client"

function ensureAdmin(token: Awaited<ReturnType<typeof getToken>>) {
  const t = token as { sub?: string; role?: string } | null
  return Boolean(t?.sub && t.role === "admin")
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!ensureAdmin(token)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await request.json().catch(() => null)) as
    | {
        role?: "admin" | "courier"
        is_disabled?: boolean
        regionIds?: string[]
      }
    | null

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  await prisma.$transaction(async (tx) => {
    const updates: Record<string, unknown> = {}
    if (body.role === "admin" || body.role === "courier") updates.role = body.role
    if (typeof body.is_disabled === "boolean") updates.is_disabled = body.is_disabled

    if (Object.keys(updates).length > 0) {
      await tx.user.update({
        where: { id: params.userId },
        data: updates
      })
    }

    if (Array.isArray(body.regionIds)) {
      await tx.userRegionAssignment.deleteMany({ where: { userId: params.userId } })
      if (body.regionIds.length > 0) {
        await tx.userRegionAssignment.createMany({
          data: body.regionIds.map((regionId) => ({ userId: params.userId, regionId })),
          skipDuplicates: true
        })
      }
    }
  })

  return NextResponse.json({ ok: true })
}

