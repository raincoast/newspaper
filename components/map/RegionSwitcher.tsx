"use client"

import { MAP_GLASS_PANEL } from "./mapGlass"
import type { RegionLite } from "./types"

export default function RegionSwitcher({
  regions,
  selectedRegionId,
  onChange
}: {
  regions: RegionLite[]
  selectedRegionId: string | null
  onChange: (regionId: string) => void
}) {
  return (
    <div className={`rounded-xl px-3 py-2 ${MAP_GLASS_PANEL}`}>
      <label className="sr-only">区域</label>
      <select
        aria-label="选择投递区域"
        value={selectedRegionId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "w-[min(200px,calc(100vw-8rem))] max-w-[220px] cursor-pointer bg-transparent text-sm font-medium",
          "outline-none focus:ring-0"
        ].join(" ")}
      >
        {regions.length === 0 ? (
          <option value="">暂无区域</option>
        ) : (
          regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))
        )}
      </select>
    </div>
  )
}
