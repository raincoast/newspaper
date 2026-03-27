import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../../lib/prisma/client"

import {
  evaluateStreetRuleSelection,
  toHouseMarkerLikeFromPrisma,
  toStreetRuleLikeFromPrisma
} from "../../../../../lib/rules-engine/streetRuleEngine"

export async function POST(
  request: NextRequest,
  { params }: { params: { streetRuleId: string } }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (token.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const rule = await prisma.streetRule.findUnique({
    where: { id: params.streetRuleId },
    select: {
      id: true,
      regionId: true,
      street_name: true,
      rule_type: true,
      from_number: true,
      to_number: true,
      include_numbers: true,
      exclude_numbers: true
    }
  })

  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const houses = await prisma.houseMarker.findMany({
    where: {
      regionId: rule.regionId,
      street_name: rule.street_name
    },
    select: {
      id: true,
      osm_default_housenumber: true,
      current_housenumber: true,
      is_number_overridden: true,
      is_manually_added: true,
      is_manually_excluded: true
    }
  })

  const streetRuleLike = toStreetRuleLikeFromPrisma(rule)

  const selections = houses.map((h) => {
    const houseLike = toHouseMarkerLikeFromPrisma(h)
    const selected = evaluateStreetRuleSelection({ rule: streetRuleLike, house: houseLike })
    return { id: h.id, selected }
  })

  const selectedCount = selections.filter((s) => s.selected).length
  const updates = selections.map((s) =>
    prisma.houseMarker.update({
      where: { id: s.id },
      data: { is_selected_by_rule: s.selected }
    })
  )

  await prisma.$transaction(updates)

  return NextResponse.json({
    ok: true,
    ruleId: rule.id,
    street_name: rule.street_name,
    regionId: rule.regionId,
    totalHouses: houses.length,
    selectedCount
  })
}

