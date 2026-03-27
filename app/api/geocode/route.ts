import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

type NominatimItem = {
  lat: string
  lon: string
  display_name: string
}

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "q required" }, { status: 400 })
  }

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "6")

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "newspaper-delivery-map/1.0 (local dev)"
    },
    next: { revalidate: 0 }
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Geocoder failed" }, { status: 502 })
  }

  const data = (await res.json()) as NominatimItem[]
  const results = data.map((row) => ({
    lat: Number(row.lat),
    lng: Number(row.lon),
    label: row.display_name
  }))

  return NextResponse.json({ results })
}
