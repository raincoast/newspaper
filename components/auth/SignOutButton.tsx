"use client"

import { signOut } from "next-auth/react"
import PrimaryButton from "../ui/PrimaryButton"

export default function SignOutButton() {
  return (
    <PrimaryButton
      className="w-auto px-3 py-1 text-xs"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      退出登录
    </PrimaryButton>
  )
}

