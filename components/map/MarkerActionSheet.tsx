"use client"

import { useMemo, useState } from "react"
import PrimaryButton from "../ui/PrimaryButton"
import type { DeliveryStatus, HouseMarkerDTO } from "./types"

export default function MarkerActionSheet({
  marker,
  open,
  loading,
  onClose,
  onSetStatus,
  onRemoveFromPlan,
  onUpdateHousenumber
}: {
  marker: HouseMarkerDTO | null
  open: boolean
  loading: boolean
  onClose: () => void
  onSetStatus: (status: DeliveryStatus) => void
  onRemoveFromPlan: () => void
  onUpdateHousenumber: (newNumber: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [newNumber, setNewNumber] = useState("")

  const oldNumber = marker?.current_housenumber ?? ""
  const displayNewNumber = useMemo(() => newNumber.trim() || "?", [newNumber])

  if (!open || !marker) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-auto absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="pointer-events-auto absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white/90 p-4 text-black backdrop-blur">
        {!isEditing ? (
          <>
            <div className="mb-3">
              <div className="text-base font-semibold">
                {marker.street_name} {marker.current_housenumber}
              </div>
              <div className="text-xs text-gray-500">
                OSM: {marker.osm_default_housenumber} · 当前状态: {marker.delivery_status}
              </div>
            </div>

            <div className="space-y-2">
              <PrimaryButton
                className="w-full justify-start"
                disabled={loading}
                onClick={() => onSetStatus("pending")}
              >
                标记未投递
              </PrimaryButton>
              <PrimaryButton
                className="w-full justify-start"
                disabled={loading}
                onClick={() => onSetStatus("delivered")}
              >
                标记已投递
              </PrimaryButton>
              <PrimaryButton
                className="w-full justify-start"
                disabled={loading}
                onClick={() => onSetStatus("blocked")}
              >
                标记不让投递
              </PrimaryButton>
              <PrimaryButton
                className="w-full justify-start"
                disabled={loading}
                onClick={onRemoveFromPlan}
              >
                从计划移除
              </PrimaryButton>
              <PrimaryButton
                className="w-full justify-start"
                disabled={loading}
                onClick={() => {
                  setIsEditing(true)
                  setNewNumber(marker.current_housenumber)
                }}
              >
                修改当前门牌号
              </PrimaryButton>
              <PrimaryButton className="w-full justify-start" disabled={loading} onClick={onClose}>
                关闭
              </PrimaryButton>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3">
              <div className="text-base font-semibold">{marker.street_name}</div>
              <div className="text-sm text-gray-700">
                {oldNumber} -&gt; {displayNewNumber}
              </div>
            </div>

            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="输入新门牌号"
              className="mb-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            />

            <div className="space-y-2">
              <PrimaryButton
                className="w-full justify-start"
                disabled={loading || !newNumber.trim()}
                onClick={() => onUpdateHousenumber(newNumber.trim())}
              >
                保存新门牌号
              </PrimaryButton>
              <PrimaryButton
                className="w-full justify-start"
                disabled={loading}
                onClick={() => setIsEditing(false)}
              >
                返回菜单
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

