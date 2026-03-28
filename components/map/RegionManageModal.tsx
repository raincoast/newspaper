"use client"

import { useCallback, useEffect, useState } from "react"
import { MAP_GLASS_PANEL } from "./mapGlass"
import type { MapBoundsRing, RegionLite } from "./types"

type ManageRow = RegionLite & { assigned: boolean; houseMarkerCount?: number }

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
              mapBoundsRing: x.mapBoundsRing as MapBoundsRing | null | undefined,
              houseMarkerCount: x.houseMarkerCount
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
      const raw = await res.text()
      let data: { region?: { id: string; name: string; mapBoundsRing: MapBoundsRing | null }; error?: string } =
        {}
      try {
        data = JSON.parse(raw) as typeof data
      } catch {
        setError(res.ok ? "创建区域失败" : `创建失败（${res.status}）`)
        return
      }
      if (!res.ok) {
        setError(data.error ?? `创建区域失败（${res.status}）`)
        return
      }
      if (!data.region) {
        setError("创建区域失败")
        return
      }
      const created: ManageRow = {
        id: data.region.id,
        name: data.region.name,
        mapBoundsRing: data.region.mapBoundsRing,
        assigned: true,
        houseMarkerCount: 0
      }
      const next = [created, ...rows]
      setRows(next)
      onRegionsUpdated(
        next
          .filter((x) => x.assigned)
          .map((x) => ({
            id: x.id,
            name: x.name,
            mapBoundsRing: x.mapBoundsRing as MapBoundsRing | null | undefined,
            houseMarkerCount: x.houseMarkerCount
          }))
      )
      onEditRegion(created.id)
      onClose()
    } catch {
      setError("创建区域失败")
    }
  }

  async function handleDeleteRegion(e: React.MouseEvent, r: ManageRow) {
    e.stopPropagation()
    const n = r.houseMarkerCount ?? 0
    if (!window.confirm(`确定删除区域「${r.name}」？`)) return
    if (!window.confirm(`当前区域共有 ${n} 个投递点。\n删除后数据不可恢复，确定删除？`)) return
    setError(null)
    try {
      const res = await fetch(`/api/regions/${encodeURIComponent(r.id)}`, { method: "DELETE" })
      if (!res.ok) {
        setError("删除区域失败")
        return
      }
      const next = rows.filter((x) => x.id !== r.id)
      setRows(next)
      onRegionsUpdated(
        next
          .filter((x) => x.assigned)
          .map((x) => ({
            id: x.id,
            name: x.name,
            mapBoundsRing: x.mapBoundsRing as MapBoundsRing | null | undefined,
            houseMarkerCount: x.houseMarkerCount
          }))
      )
    } catch {
      setError("删除区域失败")
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
            <div
              key={r.id}
              className="flex w-full items-center gap-1 rounded-xl px-1 py-1 hover:bg-black/5"
            >
              <button
                type="button"
                onClick={() => void handleRowClick(r)}
                className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-2.5 text-left"
              >
                <span className="truncate text-gray-900">{r.name}</span>
                {!r.assigned ? (
                  <span className="shrink-0 text-xs text-green-700">加入</span>
                ) : (
                  <span className="shrink-0 text-xs text-gray-400">编辑范围</span>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => void handleDeleteRegion(e, r)}
                className="shrink-0 rounded-lg px-2 py-2 text-xs text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            </div>
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
