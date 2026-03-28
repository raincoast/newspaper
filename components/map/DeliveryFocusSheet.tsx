"use client"

import { MAP_GLASS_BOTTOM_SHEET } from "./mapGlass"
import type { HouseMarkerDTO } from "./types"

export default function DeliveryFocusSheet({
  marker,
  open,
  loading,
  onClose,
  onSetDeliveryFocus
}: {
  marker: HouseMarkerDTO | null
  open: boolean
  loading: boolean
  onClose: () => void
  onSetDeliveryFocus: () => void
}) {
  if (!open || !marker) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div className="pointer-events-auto absolute inset-0 bg-black/20" onClick={onClose} />
      <div className={`pointer-events-auto absolute bottom-0 left-0 right-0 p-4 ${MAP_GLASS_BOTTOM_SHEET}`}>
        <div className="mb-3">
          <div className="text-base font-semibold">
            {marker.street_name} {marker.current_housenumber}
          </div>
          <div className="text-xs text-gray-500">设置本区域计划投递门牌</div>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => onSetDeliveryFocus()}
            className="w-full rounded-xl bg-neutral-400 px-4 py-3 text-sm font-medium text-white shadow-sm disabled:opacity-50"
          >
            设为投递点
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-gray-800"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
