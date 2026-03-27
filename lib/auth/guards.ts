import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "./options"
import type { UserRole } from "../../types/auth"

export async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }
  return session
}

export async function requireRole(role: UserRole) {
  const session = await requireUser()
  if (session.user.role !== role) {
    redirect("/map")
  }
  return session
}

