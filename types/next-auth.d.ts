import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "admin" | "courier"
    } & DefaultSession["user"]
  }

  interface User {
    role: "admin" | "courier"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "courier"
  }
}

