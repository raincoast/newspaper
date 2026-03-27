"use client"

import { useRouter } from "next/navigation"

export type RegionLite = {
  id: string
  name: string
}

export default function RegionSelector({
  regions,
  selectedRegionId
}: {
  regions: RegionLite[]
  selectedRegionId: string | null
}) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs font-medium text-gray-700 whitespace-nowrap">
        区域
      </div>
      <select
        value={selectedRegionId ?? ""}
        onChange={(e) => {
          const nextId = e.target.value
          if (!nextId) return
          router.push(`/map?regionId=${encodeURIComponent(nextId)}`)
        }}
        className={[
          "w-40 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm",
          "backdrop-blur"
        ].join(" ")}
      >
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  )
}

