import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { canCourierAccessRegion } from "../../../../lib/api/regionAccess"
import { prisma } from "../../../../lib/prisma/client"

import type { StreetRuleType } from "../../../../lib/rules-engine/streetRuleEngine"

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((v) => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
}

function isStreetRuleType(v: unknown): v is StreetRuleType {
  return (
    v === "all" ||
    v === "odd" ||
    v === "even" ||
    v === "from_number" ||
    v === "to_number" ||
    v === "include_numbers" ||
    v === "exclude_numbers"
  )
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { streetRuleId: string } }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | {
        street_name?: string
        rule_type?: unknown
        from_number?: number | null
        to_number?: number | null
        include_numbers?: unknown
        exclude_numbers?: unknown
      }
    | null

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const existing = await prisma.streetRule.findUnique({
    where: { id: params.streetRuleId }
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (token.role !== "admin") {
    const ok = await canCourierAccessRegion(token.sub, existing.regionId)
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const nextStreetName = body.street_name?.trim() || existing.street_name
  const nextRuleType = isStreetRuleType(body.rule_type) ? body.rule_type : existing.rule_type

  const nextFromNumber =
    typeof body.from_number === "number" ? body.from_number : existing.from_number
  const nextToNumber =
    typeof body.to_number === "number" ? body.to_number : existing.to_number

  const nextIncludeNumbers =
    body.include_numbers === undefined
      ? existing.include_numbers
      : normalizeStringArray(body.include_numbers)
  const nextExcludeNumbers =
    body.exclude_numbers === undefined
      ? existing.exclude_numbers
      : normalizeStringArray(body.exclude_numbers)

  try {
    const updated = await prisma.streetRule.update({
      where: { id: params.streetRuleId },
      data: {
        street_name: nextStreetName,
        rule_type: nextRuleType,
        from_number: nextFromNumber,
        to_number: nextToNumber,
        include_numbers: nextIncludeNumbers,
        exclude_numbers: nextExcludeNumbers
      }
    })

    return NextResponse.json({
      rule: {
        id: updated.id,
        regionId: updated.regionId,
        street_name: updated.street_name,
        rule_type: updated.rule_type
      }
    })
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Street rule already exists for this region/street" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Failed to update street rule" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { streetRuleId: string } }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rule = await prisma.streetRule.findUnique({
    where: { id: params.streetRuleId },
    select: { regionId: true }
  })
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (token.role !== "admin") {
    const ok = await canCourierAccessRegion(token.sub, rule.regionId)
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // 删除规则前，先解除 HouseMarker.streetRuleId 引用，避免关系限制
  await prisma.$transaction(async (tx) => {
    await tx.houseMarker.updateMany({
      where: { streetRuleId: params.streetRuleId },
      data: { streetRuleId: null }
    })
    await tx.streetRule.delete({ where: { id: params.streetRuleId } })
  })

  return NextResponse.json({ ok: true })
}

