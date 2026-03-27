import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuthPage = pathname.startsWith("/login")
  const isDashboardPage = pathname.startsWith("/map") || pathname.startsWith("/admin")

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/map", request.url))
  }

  if (isDashboardPage && !token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (pathname.startsWith("/admin") && token?.role !== "admin") {
    return NextResponse.redirect(new URL("/map", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/login", "/map/:path*", "/admin/:path*"]
}

