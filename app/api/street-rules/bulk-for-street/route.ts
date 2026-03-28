import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { isDeliveryStaff } from "../../../../lib/api/deliveryStaff"
import { prisma } from "../../../../lib/prisma/client"
import { recomputeStreetRuleSelectionForStreet } from "../../../../lib/rules-engine/recomputeStreetSelection"

import type { StreetRuleType } from "../../../../lib/rules-engine/streetRuleEngine"

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

type RuleIn = {
  rule_type?: unknown
  from_number?: number | null
  to_number?: number | null
  include_numbers?: unknown
  exclude_numbers?: unknown
}

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isDeliveryStaff(token.role as string | undefined)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as
    | {
        regionId?: string
        street_name?: string
        rules?: RuleIn[]
      }
    | null

  const regionId = body?.regionId?.trim()
  const street_name = body?.street_name?.trim()
  const rules = Array.isArray(body?.rules) ? body.rules : null

  if (!regionId || !street_name || rules === null) {
    return NextResponse.json({ error: "regionId, street_name, rules required" }, { status: 400 })
  }

  for (const r of rules) {
    if (!isStreetRuleType(r.rule_type)) {
      return NextResponse.json({ error: "Invalid rule_type in rules[]" }, { status: 400 })
    }
  }

  const region = await prisma.region.findUnique({ where: { id: regionId }, select: { id: true } })
  if (!region) return NextResponse.json({ error: "Region not found" }, { status: 404 })

  const normInclude = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()) : []
  const normExclude = normInclude

  await prisma.$transaction(async (tx) => {
    await tx.streetRule.deleteMany({ where: { regionId, street_name } })
    if (rules.length > 0) {
      await tx.streetRule.createMany({
        data: rules.map((r) => ({
          regionId,
          street_name,
          rule_type: r.rule_type as StreetRuleType,
          from_number: typeof r.from_number === "number" ? r.from_number : null,
          to_number: typeof r.to_number === "number" ? r.to_number : null,
          include_numbers: normInclude(r.include_numbers),
          exclude_numbers: normExclude(r.exclude_numbers),
          createdByUserId: token.sub
        }))
      })
    }
  })

  await recomputeStreetRuleSelectionForStreet(regionId, street_name)

  return NextResponse.json({ ok: true })
}
