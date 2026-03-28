"use client"

import { useEffect, useMemo, useState } from "react"
import PrimaryButton from "../ui/PrimaryButton"
import { MAP_GLASS_BOTTOM_SHEET } from "./mapGlass"
import type { DeliveryStatus, HouseMarkerDTO } from "./types"

export default function MarkerActionSheet({
  marker,
  open,
  loading,
  onClose,
  onSetStatus,
  onRemoveFromPlan,
  onUpdateHousenumber,
  onSaveExcludedNames,
  onDeleteMarker
}: {
  marker: HouseMarkerDTO | null
  open: boolean
  loading: boolean
  onClose: () => void
  onSetStatus: (status: DeliveryStatus) => void
  onRemoveFromPlan: () => void
  onUpdateHousenumber: (newNumber: string) => void
  onSaveExcludedNames: (names: string[]) => void | Promise<void>
  onDeleteMarker: () => void | Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [newNumber, setNewNumber] = useState("")
  const [draftNames, setDraftNames] = useState<string[]>([])
  const [nameInput, setNameInput] = useState("")

  const oldNumber = marker?.current_housenumber ?? ""
  const displayNewNumber = useMemo(() => newNumber.trim() || "?", [newNumber])

  const excludedKey = (marker?.excluded_recipient_names ?? []).join("\u0001")

  useEffect(() => {
    if (open && marker) {
      setDraftNames([...(marker.excluded_recipient_names ?? [])])
      setNameInput("")
    }
  }, [open, marker?.id, excludedKey])

  function addExcludedName() {
    const t = nameInput.trim()
    if (!t) return
    if (draftNames.some((x) => x.toLowerCase() === t.toLowerCase())) return
    setDraftNames((prev) => [...prev, t])
    setNameInput("")
  }

  function removeExcludedName(name: string) {
    setDraftNames((prev) => prev.filter((x) => x !== name))
  }

  if (!open || !marker) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-auto absolute inset-0 bg-black/20" onClick={onClose} />
      <div className={`pointer-events-auto absolute bottom-0 left-0 right-0 p-4 ${MAP_GLASS_BOTTOM_SHEET}`}>
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
                标记不让投递（整户）
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

              <div className="border-t border-black/10 pt-3">
                <div className="mb-1 text-xs font-medium text-gray-700">
                  禁投住户姓名（同一门牌内仅部分家不投）
                </div>
                <div className="mb-2 flex gap-2">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="例如 Weiss"
                    className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addExcludedName()
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={addExcludedName}
                    className="shrink-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    添加
                  </button>
                </div>
                {draftNames.length > 0 ? (
                  <ul className="mb-2 max-h-28 space-y-1 overflow-y-auto text-sm">
                    {draftNames.map((n) => (
                      <li
                        key={n}
                        className="flex items-center justify-between rounded-lg bg-black/5 px-2 py-1"
                      >
                        <span>{n}</span>
                        <button
                          type="button"
                          className="text-xs text-red-600"
                          onClick={() => removeExcludedName(n)}
                        >
                          移除
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-2 text-xs text-gray-500">暂无禁投姓名</p>
                )}
                <PrimaryButton
                  className="w-full justify-start"
                  disabled={loading}
                  onClick={() => void onSaveExcludedNames(draftNames)}
                >
                  保存禁投名单
                </PrimaryButton>
              </div>

              <PrimaryButton
                className="w-full justify-start text-red-700"
                disabled={loading}
                onClick={() => void onDeleteMarker()}
              >
                永久删除此投递点
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
