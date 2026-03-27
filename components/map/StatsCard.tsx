"use client"

import type { HouseMarkerDTO } from "./types"

export default function StatsCard({ markers }: { markers: HouseMarkerDTO[] }) {
  const totalMarked = markers.length
  const delivered = markers.filter((m) => m.delivery_status === "delivered").length
  const blocked = markers.filter((m) => m.delivery_status === "blocked").length
  const remaining = markers.filter((m) => m.delivery_status === "pending").length

  const rows: Array<{ color: string; label: string; value: number }> = [
    { color: "bg-green-600", label: "已投递", value: delivered },
    { color: "bg-neutral-400", label: "总计", value: totalMarked },
    { color: "bg-black", label: "剩余", value: remaining },
    { color: "bg-red-600", label: "禁投", value: blocked }
  ]

  return (
    <div className="rounded-xl border border-black/10 bg-white/50 p-3 text-black shadow-sm backdrop-blur">
      <div className="text-xs font-semibold">统计</div>
      <ul className="mt-2 space-y-1.5 text-xs">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.color}`} />
            <span className="min-w-0 flex-1 text-gray-800">{r.label}</span>
            <span className="tabular-nums text-gray-900">：{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
