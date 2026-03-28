"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import PrimaryButton from "../../../components/ui/PrimaryButton"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length >= 8,
    [email, password]
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">注册投递员账号</h1>
          <p className="mt-2 text-sm text-gray-600">
            注册后可在后台分配区域、维护门牌规则等。管理员账号仅由现有管理员创建。
          </p>
        </div>

        <div className="rounded-2xl bg-white/70 p-4 shadow-sm backdrop-blur">
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              if (!canSubmit) {
                setError("请填写邮箱与至少 8 位密码")
                return
              }
              setLoading(true)
              try {
                const res = await fetch("/api/auth/register", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email: email.trim(),
                    password,
                    name: name.trim() || undefined
                  })
                })
                const data = (await res.json().catch(() => ({}))) as { error?: string }
                if (!res.ok) {
                  setError(data.error ?? "注册失败")
                  return
                }
                router.push("/login?registered=1")
              } finally {
                setLoading(false)
              }
            }}
          >
            <label className="text-sm font-medium text-gray-800">显示名（可选）</label>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：张三"
              className="rounded-xl border border-black/10 bg-white px-3 py-2"
            />

            <label className="text-sm font-medium text-gray-800">邮箱</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="rounded-xl border border-black/10 bg-white px-3 py-2"
            />

            <label className="text-sm font-medium text-gray-800">密码（至少 8 位）</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
              className="rounded-xl border border-black/10 bg-white px-3 py-2"
            />

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <PrimaryButton
              type="submit"
              disabled={!canSubmit}
              aria-busy={loading}
              className="disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "提交中…" : "注册"}
            </PrimaryButton>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-gray-900 underline">
            去登录
          </Link>
          {" · "}
          <Link href="/map" className="font-medium text-gray-900 underline">
            以访客浏览地图
          </Link>
        </p>
      </div>
    </div>
  )
}
