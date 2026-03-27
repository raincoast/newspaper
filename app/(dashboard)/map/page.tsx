import { prisma } from "../../../lib/prisma/client"
import { requireUser } from "../../../lib/auth/guards"
import MapView from "../../../components/map/MapView"

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
      ? await prisma.region.findMany({ orderBy: { createdAt: "desc" } })
      : await prisma.region.findMany({
          where: { userAssignments: { some: { userId } } },
          orderBy: { createdAt: "desc" }
        })

  const selectedRegionId = (() => {
    const requested = searchParams.regionId
    if (!requested) return accessibleRegions[0]?.id ?? null
    const ok = accessibleRegions.some((r) => r.id === requested)
    return ok ? requested : accessibleRegions[0]?.id ?? null
  })()

  const selectedRegion = accessibleRegions.find((r) => r.id === selectedRegionId) ?? null

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-white/70 px-3 py-2 text-xs text-gray-600 shadow-sm backdrop-blur">
        当前用户：{session.user.email}（{session.user.role}）
        {selectedRegion ? ` · 当前区域：${selectedRegion.name}` : " · 当前无可访问区域"}
      </div>
      <MapView
        regions={accessibleRegions.map((r) => ({ id: r.id, name: r.name }))}
        initialRegionId={selectedRegionId}
      />
    </div>
  )
}

