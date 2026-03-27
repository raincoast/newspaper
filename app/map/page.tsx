import { prisma } from "../../lib/prisma/client"
import { requireUser } from "../../lib/auth/guards"
import MapView from "../../components/map/MapView"
import type { MapBoundsRing } from "../../components/map/types"

export default async function MapPage({
  searchParams
}: {
  searchParams: { regionId?: string }
}) {
  const session = await requireUser()

  const role = session.user.role
  const userId = session.user.id

  const accessibleRegions =
    role === "admin"
      ? await prisma.region.findMany({
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, mapBoundsRing: true }
        })
      : await prisma.region.findMany({
          where: { userAssignments: { some: { userId } } },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, mapBoundsRing: true }
        })

  const selectedRegionId = (() => {
    const requested = searchParams.regionId
    if (!requested) return accessibleRegions[0]?.id ?? null
    const ok = accessibleRegions.some((r) => r.id === requested)
    return ok ? requested : accessibleRegions[0]?.id ?? null
  })()

  return (
    <MapView
      regions={accessibleRegions.map((r) => ({
        id: r.id,
        name: r.name,
        mapBoundsRing: r.mapBoundsRing as MapBoundsRing | null
      }))}
      initialRegionId={selectedRegionId}
      isAdmin={role === "admin"}
    />
  )
}
