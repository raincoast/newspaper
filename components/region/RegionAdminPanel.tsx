"use client"

import { useEffect, useMemo, useState } from "react"
import PrimaryButton from "../ui/PrimaryButton"
import Modal from "../ui/Modal"

type RegionLite = { id: string; name: string }

export default function RegionAdminPanel({
  initialRegions
}: {
  initialRegions: RegionLite[]
}) {
  const [regions, setRegions] = useState<RegionLite[]>(initialRegions)
  const [loading, setLoading] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRegions(initialRegions)
  }, [initialRegions])

  const canSave = useMemo(() => name.trim().length > 0, [name])

  async function reload() {
    const res = await fetch("/api/regions", { method: "GET" })
    if (!res.ok) throw new Error("加载区域失败")
    const data = (await res.json()) as { regions: RegionLite[] }
    setRegions(data.regions)
  }

  function openCreate() {
    setMode("create")
    setEditingId(null)
    setName("")
    setError(null)
    setModalOpen(true)
  }

  function openEdit(region: RegionLite) {
    setMode("edit")
    setEditingId(region.id)
    setName(region.name)
    setError(null)
    setModalOpen(true)
  }

  async function onSave() {
    setError(null)
    if (!canSave) {
      setError("区域名称不能为空")
      return
    }

    setLoading(true)
    try {
      if (mode === "create") {
        const res = await fetch("/api/regions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() })
        })
        if (!res.ok) {
          const msg = (await res.json().catch(() => null))?.error
          throw new Error(msg ?? "创建失败")
        }
      } else {
        if (!editingId) throw new Error("缺少区域ID")
        const res = await fetch(`/api/regions/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() })
        })
        if (!res.ok) {
          const msg = (await res.json().catch(() => null))?.error
          throw new Error(msg ?? "更新失败")
        }
      }

      setModalOpen(false)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败")
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(region: RegionLite) {
    const ok = window.confirm(`确认删除区域「${region.name}」？\n此操作会移除所有用户分配。`)
    if (!ok) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/regions/${region.id}`, { method: "DELETE" })
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error
        throw new Error(msg ?? "删除失败")
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">区域管理</h2>
          <div className="mt-1 text-xs text-gray-500">
            新增/编辑/删除区域（courier 可在 seed 的分配范围内切换）
          </div>
        </div>
        <PrimaryButton
          className="w-auto px-3 py-2 text-sm"
          onClick={openCreate}
          disabled={loading}
        >
          新增区域
        </PrimaryButton>
      </div>

      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {regions.length === 0 ? (
        <div className="rounded-2xl bg-white/70 p-4 text-sm text-gray-600 shadow-sm backdrop-blur">
          暂无区域。请点击“新增区域”。
        </div>
      ) : (
        <ul className="space-y-2">
          {regions.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{r.name}</div>
                  <div className="mt-1 text-xs text-gray-500 break-all">{r.id}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <PrimaryButton
                    className="w-auto px-3 py-1 text-xs"
                    onClick={() => openEdit(r)}
                    disabled={loading}
                  >
                    编辑
                  </PrimaryButton>
                  <PrimaryButton
                    className="w-auto px-3 py-1 text-xs bg-black text-white border-black/20"
                    onClick={() => onDelete(r)}
                    disabled={loading}
                  >
                    删除
                  </PrimaryButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        title={mode === "create" ? "新增区域" : "编辑区域"}
        onClose={() => {
          if (loading) return
          setModalOpen(false)
        }}
      >
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-800">区域名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：A片区"
            className="rounded-xl border border-black/10 bg-white px-3 py-2"
          />
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          <PrimaryButton
            onClick={(e) => {
              e.preventDefault()
              onSave()
            }}
            disabled={!canSave || loading}
            className="disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "保存中..." : "保存"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  )
}

