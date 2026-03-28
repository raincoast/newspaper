"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { signIn } from "next-auth/react"
import PrimaryButton from "../../../components/ui/PrimaryButton"

export default function LoginPage() {
  const router = useRouter()
  const [registered, setRegistered] = useState(false)
  useEffect(() => {
    setRegistered(new URLSearchParams(window.location.search).get("registered") === "1")
  }, [])
  const callbackUrl = "/map"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const canSubmit = useMemo(() => email.trim() && password.trim(), [email, password])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">投递辅助系统</h1>
          <p className="mt-2 text-sm text-gray-600">邮箱密码登录（admin / courier）</p>
          {registered ? (
            <p className="mt-2 text-sm text-green-700">注册成功，请使用刚才的邮箱密码登录。</p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-white/70 p-4 shadow-sm backdrop-blur">
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)

              if (!canSubmit) {
                setError("请输入邮箱和密码")
                return
              }

              setLoading(true)
              const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
                callbackUrl
              })
              setLoading(false)

              if (result?.error) {
                setError("邮箱或密码错误")
                return
              }

              router.push(callbackUrl)
            }}
          >
            <label className="text-sm font-medium text-gray-800">邮箱</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="demo.admin@example.com"
              className="rounded-xl border border-black/10 bg-white px-3 py-2"
            />

            <label className="text-sm font-medium text-gray-800">密码</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="rounded-xl border border-black/10 bg-white px-3 py-2"
            />

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <PrimaryButton
              type="submit"
              disabled={!canSubmit}
              aria-busy={loading}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "登录中..." : "登录并进入地图"}
            </PrimaryButton>
          </form>
        </div>

        <div className="rounded-2xl bg-white/70 p-4 text-xs text-gray-600 shadow-sm backdrop-blur">
          <div>Demo 账号（运行 seed 后可用）</div>
          <div className="mt-1">admin: demo.admin@example.com / Admin1234!</div>
          <div>courier: demo.courier@example.com / Courier1234!</div>
        </div>

        <p className="text-center text-sm text-gray-600">
          <Link href="/map" className="font-medium text-gray-900 underline">
            以访客浏览地图（无需登录）
          </Link>
          {" · "}
          <Link href="/register" className="font-medium text-gray-900 underline">
            注册新账号
          </Link>
        </p>
      </div>
    </div>
  )
}

