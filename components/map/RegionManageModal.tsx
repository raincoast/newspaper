"use client"

import { useCallback, useEffect, useState } from "react"
import { MAP_GLASS_PANEL } from "./mapGlass"
import type { MapBoundsRing, RegionLite } from "./types"

type ManageRow = RegionLite & { assigned: boolean }

export default function RegionManageModal({
  open,
  onClose,
  onEditRegion,
  onRegionsUpdated
}: {
  open: boolean
  onClose: () => void
  onEditRegion: (regionId: string) => void
  onRegionsUpdated: (regions: RegionLite[]) => void
}) {
  const [rows, setRows] = useState<ManageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/regions?manage=1")
      if (!res.ok) throw new Error("加载失败")
      const data = (await res.json()) as { regions: ManageRow[] }
      setRows(data.regions)
    } catch {
      setError("无法加载区域列表")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  async function ensureAssigned(regionId: string) {
    const res = await fetch("/api/user-regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId })
    })
    if (!res.ok) throw new Error("加入区域失败")
  }

  async function handleRowClick(r: ManageRow) {
    setError(null)
    try {
      let next = rows
      if (!r.assigned) {
        await ensureAssigned(r.id)
        next = rows.map((x) => (x.id === r.id ? { ...x, assigned: true } : x))
        setRows(next)
        onRegionsUpdated(
          next
            .filter((x) => x.assigned)
            .map((x) => ({
              id: x.id,
              name: x.name,
              mapBoundsRing: x.mapBoundsRing as MapBoundsRing | null | undefined
            }))
        )
      }
      onEditRegion(r.id)
      onClose()
    } catch {
      setError("操作失败，请重试")
    }
  }

  async function handleAdd() {
    const name = window.prompt("新区域名称？")?.trim()
    if (!name) return
    setError(null)
    try {
      const res = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      })
      if (!res.ok) throw new Error("创建失败")
      const data = (await res.json()) as {
        region: { id: string; name: string; mapBoundsRing: MapBoundsRing | null }
      }
      const created: ManageRow = {
        id: data.region.id,
        name: data.region.name,
        mapBoundsRing: data.region.mapBoundsRing,
        assigned: true
      }
      const next = [created, ...rows]
      setRows(next)
      onRegionsUpdated(
        next
          .filter((x) => x.assigned)
          .map((x) => ({
            id: x.id,
            name: x.name,
            mapBoundsRing: x.mapBoundsRing as MapBoundsRing | null | undefined
          }))
      )
      onEditRegion(created.id)
      onClose()
    } catch {
      setError("创建区域失败")
    }
  }

  if (!open) return null

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={`relative z-10 max-h-[70vh] w-full max-w-sm overflow-hidden rounded-t-2xl shadow-xl sm:rounded-2xl ${MAP_GLASS_PANEL}`}
      >
        <div className="border-b border-black/10 px-4 py-3 text-sm font-semibold text-gray-900">
          区域
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-2 py-2 text-sm">
          {loading ? (
            <div className="px-2 py-4 text-center text-gray-500">加载中…</div>
          ) : error ? (
            <div className="px-2 py-2 text-red-600">{error}</div>
          ) : null}
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => void handleRowClick(r)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-black/5"
            >
              <span className="text-gray-900">{r.name}</span>
              {!r.assigned ? (
                <span className="text-xs text-green-700">加入</span>
              ) : (
                <span className="text-xs text-gray-400">编辑范围</span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-green-700 hover:bg-green-50"
          >
            <span className="text-lg leading-none">+</span>
            <span>添加区域</span>
          </button>
        </div>
      </div>
    </div>
  )
}
