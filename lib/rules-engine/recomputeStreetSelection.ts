import { prisma } from "../prisma/client"
import {
  evaluateStreetRulesUnion,
  toHouseMarkerLikeFromPrisma,
  toStreetRuleLikeFromPrisma
} from "./streetRuleEngine"

export async function recomputeStreetRuleSelectionForStreet(regionId: string, streetName: string) {
  const rules = await prisma.streetRule.findMany({
    where: { regionId, street_name: streetName },
    orderBy: { createdAt: "asc" }
  })
  const likes = rules.map(toStreetRuleLikeFromPrisma)

  const houses = await prisma.houseMarker.findMany({
    where: { regionId, street_name: streetName },
    select: {
      id: true,
      osm_default_housenumber: true,
      current_housenumber: true,
      is_number_overridden: true,
      is_manually_added: true,
      is_manually_excluded: true
    }
  })

  const updates = houses.map((h) => {
    const selected = evaluateStreetRulesUnion(likes, toHouseMarkerLikeFromPrisma(h))
    return prisma.houseMarker.update({
      where: { id: h.id },
      data: { is_selected_by_rule: selected }
    })
  })

  if (updates.length > 0) {
    await prisma.$transaction(updates)
  }
}
