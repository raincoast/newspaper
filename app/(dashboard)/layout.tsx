import Link from "next/link"
import SignOutButton from "../../components/auth/SignOutButton"
import { requireUser } from "../../lib/auth/guards"

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await requireUser()
  const isAdmin = session.user.role === "admin"

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="border-b border-black/5 bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div>
            <div className="font-semibold">投递辅助</div>
            <div className="text-xs text-gray-500">{session.user.email}</div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-4">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-black/10 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2">
          <Link
            href="/map"
            className="rounded-xl bg-white px-4 py-2 text-sm text-black shadow-sm"
          >
            地图
          </Link>
          {isAdmin ? (
            <Link
              href="/admin"
              className="rounded-xl bg-white px-4 py-2 text-sm text-black shadow-sm"
            >
              管理
            </Link>
          ) : (
            <div className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-500">管理</div>
          )}
        </div>
      </nav>
    </div>
  )
}

