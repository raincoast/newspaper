"use client"

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
    <div className="rounded-xl border border-black/10 bg-white/80 p-2 text-black shadow-sm backdrop-blur">
      <div className="mb-1 text-xs font-medium">区域</div>
      <select
        value={selectedRegionId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-40 rounded-lg border border-black/10 bg-white px-2 py-2 text-sm"
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

