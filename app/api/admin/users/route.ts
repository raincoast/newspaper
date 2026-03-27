import { hash } from "bcryptjs"
import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../lib/prisma/client"

function ensureAdmin(token: Awaited<ReturnType<typeof getToken>>) {
  const t = token as { sub?: string; role?: string } | null
  return Boolean(t?.sub && t.role === "admin")
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!ensureAdmin(token)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const [users, regions] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_disabled: true,
        assignments: {
          select: { regionId: true }
        }
      }
    }),
    prisma.region.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true }
    })
  ])

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      regionIds: u.assignments.map((a) => a.regionId)
    })),
    regions
  })
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!ensureAdmin(token)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string
        email?: string
        password?: string
        role?: "admin" | "courier"
        regionIds?: string[]
      }
    | null

  const name = body?.name?.trim()
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password?.trim()
  const role = body?.role
  const regionIds = (body?.regionIds ?? []).filter(Boolean)

  if (!name || !email || !password || (role !== "admin" && role !== "courier")) {
    return NextResponse.json({ error: "name/email/password/role required" }, { status: 400 })
  }

  const passwordHash = await hash(password, 10)

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role
      },
      select: { id: true }
    })

    if (regionIds.length > 0) {
      await prisma.userRegionAssignment.createMany({
        data: regionIds.map((regionId) => ({ userId: user.id, regionId })),
        skipDuplicates: true
      })
    }

    return NextResponse.json({ ok: true, userId: user.id })
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "email already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "failed to create user" }, { status: 500 })
  }
}

