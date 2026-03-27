"use client"

import { useEffect, useState } from "react"
import PrimaryButton from "../ui/PrimaryButton"

type RegionLite = { id: string; name: string }
type UserItem = {
  id: string
  name: string | null
  email: string
  role: "admin" | "courier"
  is_disabled: boolean
  regionIds: string[]
}

export default function UserManagementPanel() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [regions, setRegions] = useState<RegionLite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "courier">("courier")
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([])

  async function reload() {
    const res = await fetch("/api/admin/users")
    if (!res.ok) throw new Error("加载用户失败")
    const data = (await res.json()) as { users: UserItem[]; regions: RegionLite[] }
    setUsers(data.users)
    setRegions(data.regions)
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message))
  }, [])

  async function createUser() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          regionIds: selectedRegionIds
        })
      })
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error
        throw new Error(msg ?? "创建失败")
      }
      setName("")
      setEmail("")
      setPassword("")
      setRole("courier")
      setSelectedRegionIds([])
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败")
    } finally {
      setLoading(false)
    }
  }

  async function updateUser(
    userId: string,
    payload: {
      role?: "admin" | "courier"
      is_disabled?: boolean
      regionIds?: string[]
    }
  ) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error
        throw new Error(msg ?? "更新失败")
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white/70 p-4 shadow-sm backdrop-blur">
      <h3 className="text-lg font-semibold">用户管理</h3>
      {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}

      <div className="mt-3 grid gap-2">
        <input
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          placeholder="姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          placeholder="初始密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "courier")}
        >
          <option value="courier">courier</option>
          <option value="admin">admin</option>
        </select>

        <div className="rounded-xl border border-black/10 p-2 text-sm">
          <div className="mb-1 text-xs text-gray-600">分配区域</div>
          <div className="grid grid-cols-2 gap-1">
            {regions.map((r) => {
              const checked = selectedRegionIds.includes(r.id)
              return (
                <label key={r.id} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRegionIds((prev) => [...prev, r.id])
                      else setSelectedRegionIds((prev) => prev.filter((x) => x !== r.id))
                    }}
                  />
                  {r.name}
                </label>
              )
            })}
          </div>
        </div>

        <PrimaryButton disabled={loading} onClick={createUser}>
          创建用户
        </PrimaryButton>
      </div>

      <div className="mt-4 space-y-2">
        {users.map((u) => (
          <div key={u.id} className="rounded-xl border border-black/10 bg-white p-3">
            <div className="text-sm font-semibold">{u.name ?? "(未命名)"} · {u.email}</div>
            <div className="mt-1 text-xs text-gray-500">
              角色: {u.role} · 状态: {u.is_disabled ? "已禁用" : "启用"}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <PrimaryButton
                className="w-auto px-3 py-1 text-xs"
                disabled={loading}
                onClick={() => updateUser(u.id, { role: u.role === "admin" ? "courier" : "admin" })}
              >
                切换角色
              </PrimaryButton>
              <PrimaryButton
                className="w-auto px-3 py-1 text-xs"
                disabled={loading}
                onClick={() => updateUser(u.id, { is_disabled: !u.is_disabled })}
              >
                {u.is_disabled ? "启用用户" : "禁用用户"}
              </PrimaryButton>
              <PrimaryButton
                className="w-auto px-3 py-1 text-xs"
                disabled={loading}
                onClick={() => {
                  const pool = regions.map((r) => r.id)
                  const next =
                    u.regionIds.length === pool.length
                      ? []
                      : pool
                  updateUser(u.id, { regionIds: next })
                }}
              >
                {u.regionIds.length === regions.length ? "清空区域分配" : "分配全部区域"}
              </PrimaryButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

