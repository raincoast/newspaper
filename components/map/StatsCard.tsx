"use client"

import type { HouseMarkerDTO } from "./types"

export default function StatsCard({ markers }: { markers: HouseMarkerDTO[] }) {
  const totalMarked = markers.length
  const delivered = markers.filter((m) => m.delivery_status === "delivered").length
  const blocked = markers.filter((m) => m.delivery_status === "blocked").length
  const remaining = markers.filter((m) => m.delivery_status === "pending").length

  return (
    <div className="rounded-xl border border-black/10 bg-white/80 p-3 text-black shadow-sm backdrop-blur">
      <div className="text-xs font-semibold">当前区域统计</div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg bg-green-600 p-2 text-white">已 {delivered}</div>
        <div className="rounded-lg bg-gray-100 p-2">总 {totalMarked}</div>
        <div className="rounded-lg bg-black p-2 text-white">剩 {remaining}</div>
        <div className="rounded-lg bg-red-600 p-2 text-white">禁 {blocked}</div>
      </div>
    </div>
  )
}

