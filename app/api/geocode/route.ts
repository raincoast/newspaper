import { NextRequest, NextResponse } from "next/server"

type NominatimItem = {
  lat: string
  lon: string
  display_name: string
}

/**
 * Nominatim 搜索；默认偏重德国 (countrycodes=de)，英语/德语查询均支持。
 * 见 https://nominatim.org/release-docs/develop/api/Search/
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "q required" }, { status: 400 })
  }

  const countrycodes =
    request.nextUrl.searchParams.get("countrycodes")?.trim() || "de"

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "8")
  url.searchParams.set("addressdetails", "1")
  if (countrycodes) {
    url.searchParams.set("countrycodes", countrycodes)
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "newspaper-delivery-map/1.0",
      "Accept-Language": "en-US,en,de-DE,de"
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
