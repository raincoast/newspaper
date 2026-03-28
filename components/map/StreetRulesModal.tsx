"use client"

import { useCallback, useEffect, useState } from "react"
import {
  evaluateStreetRulesUnion,
  toHouseMarkerLikeFromPrisma,
  type StreetRuleLike,
  type StreetRuleType
} from "../../lib/rules-engine/streetRuleEngine"
import { MAP_GLASS_MODAL } from "./mapGlass"
import type { HouseMarkerDTO } from "./types"

type ApiRule = {
  id: string
  rule_type: StreetRuleType
  from_number: number | null
  to_number: number | null
}

type Row = { key: string; rule_type: "all" | "odd" | "even"; from: string; to: string }

function dtoToHouseLike(m: HouseMarkerDTO) {
  return toHouseMarkerLikeFromPrisma({
    osm_default_housenumber: m.osm_default_housenumber,
    current_housenumber: m.current_housenumber,
    is_number_overridden: m.is_number_overridden,
    is_manually_added: m.is_manually_added,
    is_manually_excluded: m.is_manually_excluded
  })
}

function rowToLike(r: Row): StreetRuleLike | null {
  const fromTrim = r.from.trim()
  const toTrim = r.to.trim()
  const fromN = fromTrim === "" ? null : Number(fromTrim)
  const toN = toTrim === "" ? null : Number(toTrim)
  if (fromTrim !== "" && !Number.isFinite(fromN)) return null
  if (toTrim !== "" && !Number.isFinite(toN)) return null
  return {
    ruleType: r.rule_type,
    fromNumber: fromTrim === "" ? null : fromN,
    toNumber: toTrim === "" ? null : toN
  }
}

function apiRuleToRow(r: ApiRule): Row {
  const from = r.from_number != null ? String(r.from_number) : ""
  const to = r.to_number != null ? String(r.to_number) : ""
  if (r.rule_type === "all" || r.rule_type === "odd" || r.rule_type === "even") {
    return { key: r.id, rule_type: r.rule_type, from, to }
  }
  if (r.rule_type === "from_number" || r.rule_type === "to_number") {
    return { key: r.id, rule_type: "all", from, to }
  }
  return { key: r.id, rule_type: "all", from: "", to: "" }
}

export default function StreetRulesModal({
  open,
  regionId,
  streetName,
  markersOnStreet,
  onClose,
  onSaved,
  onPreviewMatchesChange
}: {
  open: boolean
  regionId: string
  streetName: string
  markersOnStreet: HouseMarkerDTO[]
  onClose: () => void
  onSaved: () => void
  onPreviewMatchesChange: (ids: Set<string>) => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pushPreview = useCallback(
    (nextRows: Row[]) => {
      const likes: StreetRuleLike[] = []
      for (const r of nextRows) {
        const like = rowToLike(r)
        if (like) likes.push(like)
      }
      const ids = new Set<string>()
      for (const m of markersOnStreet) {
        if (evaluateStreetRulesUnion(likes, dtoToHouseLike(m))) ids.add(m.id)
      }
      onPreviewMatchesChange(ids)
    },
    [markersOnStreet, onPreviewMatchesChange]
  )

  useEffect(() => {
    if (!open) {
      onPreviewMatchesChange(new Set())
      return
    }
    pushPreview(rows)
  }, [open, rows, pushPreview, onPreviewMatchesChange])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(
          `/api/street-rules?regionId=${encodeURIComponent(regionId)}&street_name=${encodeURIComponent(streetName)}`
        )
        if (!res.ok) throw new Error("load")
        const data = (await res.json()) as { rules: ApiRule[] }
        const list = (data.rules ?? []).filter((r) => r.rule_type !== "include_numbers" && r.rule_type !== "exclude_numbers")
        setRows(
          list.length > 0
            ? list.map(apiRuleToRow)
            : [{ key: "new-1", rule_type: "all", from: "", to: "" }]
        )
      } catch {
        setError("无法加载规则")
        setRows([{ key: "new-1", rule_type: "all", from: "", to: "" }])
      } finally {
        setLoading(false)
      }
    })()
  }, [open, regionId, streetName])

  function addRow() {
    setRows((prev) => [...prev, { key: `new-${Date.now()}`, rule_type: "all", from: "", to: "" }])
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  async function save() {
    setError(null)
    const payloadRules: Array<{
      rule_type: "all" | "odd" | "even"
      from_number: number | null
      to_number: number | null
    }> = []
    for (const r of rows) {
      const like = rowToLike(r)
      if (!like) {
        setError("请检查门牌范围（须为数字）")
        return
      }
      payloadRules.push({
        rule_type: like.ruleType as "all" | "odd" | "even",
        from_number: like.fromNumber ?? null,
        to_number: like.toNumber ?? null
      })
    }

    setSaving(true)
    try {
      const res = await fetch("/api/street-rules/bulk-for-street", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId,
          street_name: streetName,
          rules: payloadRules
        })
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? "保存失败")
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="pointer-events-auto fixed inset-0 z-[55] flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden ${MAP_GLASS_MODAL}`}
      >
        <div className="border-b border-black/10 px-4 py-3">
          <h2 className="text-left text-base font-semibold text-gray-900">{streetName}</h2>
          <p className="mt-1 text-xs text-gray-600">
            多条规则取并集；奇偶仅看门牌前导数字（如 31a 视为 31）。
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">加载中…</div>
          ) : (
            <div className="space-y-3">
              {error ? <div className="text-sm text-red-600">{error}</div> : null}
              {rows.map((r, i) => (
                <div
                  key={r.key}
                  className="rounded-xl border border-black/10 bg-white/40 p-3 backdrop-blur-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">规则 {i + 1}</span>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => removeRow(r.key)}
                      >
                        删除
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-gray-600">
                      从
                      <input
                        value={r.from}
                        onChange={(e) => {
                          const v = e.target.value
                          setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, from: v } : x)))
                        }}
                        placeholder="如 1"
                        className="mt-0.5 w-full rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs text-gray-600">
                      到
                      <input
                        value={r.to}
                        onChange={(e) => {
                          const v = e.target.value
                          setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, to: v } : x)))
                        }}
                        placeholder="如 31"
                        className="mt-0.5 w-full rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                  <label className="mt-2 block text-xs text-gray-600">范围方式</label>
                  <select
                    value={r.rule_type}
                    onChange={(e) => {
                      const v = e.target.value as Row["rule_type"]
                      setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, rule_type: v } : x)))
                    }}
                    className="mt-0.5 w-full rounded-lg border border-black/10 bg-white/60 px-2 py-2 text-sm"
                  >
                    <option value="all">全部（范围内）</option>
                    <option value="odd">奇数</option>
                    <option value="even">偶数</option>
                  </select>
                </div>
              ))}
              <button
                type="button"
                onClick={addRow}
                className="w-full rounded-xl border border-dashed border-black/20 py-2 text-sm text-gray-700 hover:bg-black/5"
              >
                + 添加规则（并集）
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-black/10 p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-black/10 bg-white/40 py-2.5 text-sm font-medium backdrop-blur-sm"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="flex-1 rounded-xl bg-blue-600/90 py-2.5 text-sm font-medium text-white shadow-sm backdrop-blur-sm disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存并应用"}
          </button>
        </div>
      </div>
    </div>
  )
}
