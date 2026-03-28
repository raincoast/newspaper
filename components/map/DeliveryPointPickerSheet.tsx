"use client"

import type { HouseMarkerDTO } from "./types"

export default function DeliveryPointPickerSheet({
  open,
  onClose,
  markers,
  loading,
  onPick
}: {
  open: boolean
  onClose: () => void
  markers: HouseMarkerDTO[]
  loading: boolean
  onPick: (markerId: string) => void
}) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[45] bg-black/25"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-[46] max-h-[55vh] overflow-hidden rounded-t-2xl border border-black/10 bg-white/95 shadow-lg backdrop-blur">
        <div className="border-b border-black/10 px-4 py-3 text-sm font-medium text-gray-900">
          选择当前区域的投递点
        </div>
        <ul className="max-h-[44vh] overflow-y-auto py-1">
          {markers.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-500">暂无门牌数据</li>
          ) : (
            markers.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={loading}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-gray-900 hover:bg-black/5 disabled:opacity-50"
                  onClick={() => onPick(m.id)}
                >
                  <span>
                    {m.street_name} {m.current_housenumber}
                  </span>
                  {m.is_delivery_focus ? (
                    <span className="shrink-0 text-xs font-medium text-green-700">当前</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  )
}
