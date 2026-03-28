import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { isDeliveryStaff } from "../../../lib/api/deliveryStaff"
import { isPublicDemoRegion } from "../../../lib/api/regionAccess"
import { prisma } from "../../../lib/prisma/client"
import { recomputeStreetRuleSelectionForStreet } from "../../../lib/rules-engine/recomputeStreetSelection"

import type { StreetRuleType } from "../../../lib/rules-engine/streetRuleEngine"

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

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const { searchParams } = new URL(request.url)
  const regionId = searchParams.get("regionId") ?? undefined
  const streetNameFilter = searchParams.get("street_name")?.trim()

  if (!token?.sub) {
    if (!regionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const pub = await isPublicDemoRegion(regionId)
    if (!pub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const rules = await prisma.streetRule.findMany({
      where: {
        regionId,
        ...(streetNameFilter ? { street_name: streetNameFilter } : {})
      },
      orderBy: { createdAt: "desc" }
    })
    return NextResponse.json({
      rules: rules.map((r) => ({
        id: r.id,
        regionId: r.regionId,
        street_name: r.street_name,
        rule_type: r.rule_type,
        from_number: r.from_number,
        to_number: r.to_number,
        include_numbers: r.include_numbers,
        exclude_numbers: r.exclude_numbers
      }))
    })
  }

  const role = token.role
  const userId = token.sub

  const baseWhere =
    role === "admin" || role === "courier"
      ? regionId
        ? { regionId }
        : {}
      : regionId
        ? { regionId, region: { userAssignments: { some: { userId } } } }
        : { region: { userAssignments: { some: { userId } } } }

  const where = {
    ...baseWhere,
    ...(streetNameFilter ? { street_name: streetNameFilter } : {})
  }

  const rules = await prisma.streetRule.findMany({
    where: where as any,
    orderBy: { createdAt: "desc" }
  })

  return NextResponse.json({
    rules: rules.map((r) => ({
      id: r.id,
      regionId: r.regionId,
      street_name: r.street_name,
      rule_type: r.rule_type,
      from_number: r.from_number,
      to_number: r.to_number,
      include_numbers: r.include_numbers,
      exclude_numbers: r.exclude_numbers
    }))
  })
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | {
        regionId?: string
        street_name?: string
        rule_type?: unknown
        from_number?: number | null
        to_number?: number | null
        include_numbers?: unknown
        exclude_numbers?: unknown
      }
    | null

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  if (!body.regionId || !body.street_name || !isStreetRuleType(body.rule_type)) {
    return NextResponse.json({ error: "regionId, street_name, rule_type are required" }, { status: 400 })
  }

  if (!isDeliveryStaff(token.role as string | undefined)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const include_numbers = normalizeStringArray(body.include_numbers)
  const exclude_numbers = normalizeStringArray(body.exclude_numbers)

  const streetName = body.street_name.trim()
  const rule = await prisma.streetRule.create({
    data: {
      regionId: body.regionId,
      street_name: streetName,
      rule_type: body.rule_type,
      from_number: typeof body.from_number === "number" ? body.from_number : null,
      to_number: typeof body.to_number === "number" ? body.to_number : null,
      include_numbers,
      exclude_numbers,
      createdByUserId: token.sub
    }
  })

  await recomputeStreetRuleSelectionForStreet(rule.regionId, rule.street_name)

  return NextResponse.json({
    rule: {
      id: rule.id,
      regionId: rule.regionId,
      street_name: rule.street_name,
      rule_type: rule.rule_type
    }
  })
}

