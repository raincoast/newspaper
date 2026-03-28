import { getServerSession } from "next-auth"
import MapView from "../../components/map/MapView"
import type { MapBoundsRing } from "../../components/map/types"
import { authOptions } from "../../lib/auth/options"
import { prisma } from "../../lib/prisma/client"

export default async function MapPage({
  searchParams
}: {
  searchParams: { regionId?: string }
}) {
  const session = await getServerSession(authOptions)
  const user = session?.user

  const accessibleRegions = user
    ? user.role === "admin"
      ? await prisma.region.findMany({
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, mapBoundsRing: true }
        })
      : await prisma.region.findMany({
          where: { userAssignments: { some: { userId: user.id } } },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, mapBoundsRing: true }
        })
    : await prisma.region.findMany({
        where: { isPublicDemo: true },
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
      guestMode={!user}
      regions={accessibleRegions.map((r) => ({
        id: r.id,
        name: r.name,
        mapBoundsRing: r.mapBoundsRing as MapBoundsRing | null
      }))}
      initialRegionId={selectedRegionId}
      isAdmin={user?.role === "admin"}
    />
  )
}
