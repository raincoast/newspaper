import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import { isDeliveryStaff } from "../../../../../lib/api/deliveryStaff"
import { prisma } from "../../../../../lib/prisma/client"
import { recomputeStreetRuleSelectionForStreet } from "../../../../../lib/rules-engine/recomputeStreetSelection"

export async function POST(
  request: NextRequest,
  { params }: { params: { streetRuleId: string } }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rule = await prisma.streetRule.findUnique({
    where: { id: params.streetRuleId },
    select: {
      id: true,
      regionId: true,
      street_name: true
    }
  })

  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isDeliveryStaff(token.role as string | undefined)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await recomputeStreetRuleSelectionForStreet(rule.regionId, rule.street_name)

  const houses = await prisma.houseMarker.findMany({
    where: { regionId: rule.regionId, street_name: rule.street_name },
    select: { id: true, is_selected_by_rule: true }
  })

  return NextResponse.json({
    ok: true,
    ruleId: rule.id,
    street_name: rule.street_name,
    regionId: rule.regionId,
    totalHouses: houses.length,
    selectedCount: houses.filter((h) => h.is_selected_by_rule).length
  })
}
