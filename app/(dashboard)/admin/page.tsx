import { prisma } from "../../../lib/prisma/client"
import { requireRole } from "../../../lib/auth/guards"
import RegionAdminPanel from "../../../components/region/RegionAdminPanel"
import UserManagementPanel from "../../../components/admin/UserManagementPanel"

export default async function AdminPage() {
  const session = await requireRole("admin")

  const regions = await prisma.region.findMany({
    orderBy: { createdAt: "desc" }
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-white/70 p-4 shadow-sm backdrop-blur">
        <h2 className="text-lg font-semibold">管理</h2>
        <p className="mt-1 text-xs text-gray-500">
          当前用户：{session.user.email}（{session.user.role}）
        </p>
        <p className="mt-1 text-sm text-gray-600">
          区域管理已实现（新增/编辑/删除）。下一阶段会接入街道规则与门牌图层。
        </p>
      </div>

      <RegionAdminPanel
        initialRegions={regions.map((r) => ({ id: r.id, name: r.name }))}
      />

      <UserManagementPanel />
    </div>
  )
}

