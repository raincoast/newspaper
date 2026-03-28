import { hash } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../lib/prisma/client"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string; name?: string }
    | null

  const email = body?.email?.trim().toLowerCase()
  const password = body?.password
  const name = body?.name?.trim() || null

  if (!email || !password) {
    return NextResponse.json({ error: "邮箱与密码必填" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 })
  }

  const passwordHash = await hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: "courier"
    },
    select: { id: true, email: true }
  })

  return NextResponse.json({ ok: true, user })
}
