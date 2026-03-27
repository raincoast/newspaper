"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import maplibregl, { type LngLatBoundsLike, type Map } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useRouter } from "next/navigation"

import MarkerActionSheet from "./MarkerActionSheet"
import RegionManageModal from "./RegionManageModal"
import RegionSwitcher from "./RegionSwitcher"
import StatsCard from "./StatsCard"
import type { ApartmentGroupOverlay, DeliveryStatus, HouseMarkerDTO, MapBoundsRing, RegionLite } from "./types"
import {
  bindHouseMarkerClick,
  removeHouseMarkerLayer,
  upsertApartmentGroupLayer,
  upsertConflictConnectionLayer,
  upsertNearbyHouseMarkerLayer,
  upsertHouseMarkerLayer
} from "./HouseMarkerLayer"
import { removeUserLocationLayer, upsertUserLocationLayer } from "./UserLocationLayer"
import { RegionBoundsEditor, ringToLngLatBounds, type RingPoint } from "./regionBoundsEditor"

const KONSTANZ_JBS: [number, number] = [9.17145, 47.66365]

function normalizeRing(raw: unknown): RingPoint[] | null {
  if (!raw || !Array.isArray(raw) || raw.length !== 4) return null
  const out: RingPoint[] = []
  for (const p of raw) {
    if (!p || typeof p !== "object") return null
    const o = p as { lng?: unknown; lat?: unknown }
    const lng = Number(o.lng)
    const lat = Number(o.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
    out.push({ lng, lat })
  }
  return out
}

const glassPanel =
  "rounded-xl border border-black/10 bg-white/50 shadow-sm backdrop-blur"

function RegionListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="text-gray-800">
      <path
        d="M5 6h14M5 12h14M5 18h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="18" cy="18" r="2.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

function AreaToolIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="text-gray-800">
      <path
        d="M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4zm12 0h4v4h-4v-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 6h8M6 8v8m12 0V8M8 18h8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function MapView({
  regions,
  initialRegionId
}: {
  regions: RegionLite[]
  initialRegionId: string | null
}) {
  const router = useRouter()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)

  const [regionsLocal, setRegionsLocal] = useState<RegionLite[]>(regions)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialRegionId)
  const [markers, setMarkers] = useState<HouseMarkerDTO[]>([])
  const [apartmentGroups, setApartmentGroups] = useState<ApartmentGroupOverlay[]>([])
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
    accuracy?: number | null
  } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [deliveryActive, setDeliveryActive] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const [manageOpen, setManageOpen] = useState(false)
  const [editRegionId, setEditRegionId] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState("")
  const [searchHits, setSearchHits] = useState<
    Array<{ lat: number; lng: number; label: string }>
  >([])
  const [searchBusy, setSearchBusy] = useState(false)

  const editModeRef = useRef<string | null>(null)
  const regionsRef = useRef(regionsLocal)
  regionsRef.current = regionsLocal
  const boundsEditorRef = useRef<RegionBoundsEditor | null>(null)

  useEffect(() => {
    setRegionsLocal(regions)
  }, [regions])

  useEffect(() => {
    setSelectedRegionId(initialRegionId)
  }, [initialRegionId])

  useEffect(() => {
    editModeRef.current = editRegionId
  }, [editRegionId])

  const selectedMarker = useMemo(
    () => markers.find((m) => m.id === selectedMarkerId) ?? null,
    [markers, selectedMarkerId]
  )

  const nearbyMarkers = useMemo(() => {
    if (!userLocation) return [] as HouseMarkerDTO[]
    const NEARBY_RADIUS_METERS = 120
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180

    const haversineMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const dLat = toRad(bLat - aLat)
      const dLng = toRad(bLng - aLng)
      const aa =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
      return R * c
    }

    return markers.filter((m) => {
      const dist = haversineMeters(userLocation.lat, userLocation.lng, m.lat, m.lng)
      return dist <= NEARBY_RADIUS_METERS
    })
  }, [markers, userLocation])

  const nextMarker = useMemo(() => {
    if (!deliveryActive || !userLocation) return null
    const candidates = markers.filter((m) => m.delivery_status === "pending")
    if (candidates.length === 0) return null

    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const haversineMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const dLat = toRad(bLat - aLat)
      const dLng = toRad(bLng - aLng)
      const aa =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
      return R * c
    }

    return candidates.reduce((best, cur) => {
      const d = haversineMeters(userLocation.lat, userLocation.lng, cur.lat, cur.lng)
      if (!best) return { marker: cur, dist: d }
      return d < best.dist ? { marker: cur, dist: d } : best
    }, null as null | { marker: HouseMarkerDTO; dist: number })
  }, [deliveryActive, markers, userLocation])

  const conflictLineFeatures = useMemo(() => {
    if (!selectedMarker || !selectedMarker.is_conflict) return []
    const from: [number, number] = [selectedMarker.lng, selectedMarker.lat]
    return selectedMarker.conflict_peer_ids
      .map((peerId) => {
        const peer = markers.find((m) => m.id === peerId)
        if (!peer) return null
        const to: [number, number] = [peer.lng, peer.lat]
        return {
          id: `${selectedMarker.id}-${peer.id}`,
          coordinates: [from, to] as [number, number][]
        }
      })
      .filter(Boolean) as Array<{ id: string; coordinates: [number, number][] }>
  }, [markers, selectedMarker])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors"
          }
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm"
          }
        ]
      },
      center: KONSTANZ_JBS,
      zoom: 16
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right")

    map.on("load", () => {
      void (async () => {
        await upsertHouseMarkerLayer(map, [])
        bindHouseMarkerClick(map, (markerId) => {
          if (editModeRef.current) return
          setSelectedMarkerId(markerId)
        })
      })()
    })

    mapRef.current = map

    return () => {
      if (!mapRef.current) return
      boundsEditorRef.current?.destroy()
      boundsEditorRef.current = null
      removeUserLocationLayer(mapRef.current)
      removeHouseMarkerLayer(mapRef.current)
      mapRef.current.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    async function loadMarkers() {
      if (!selectedRegionId) {
        setMarkers([])
        setApartmentGroups([])
        return
      }
      const res = await fetch(`/api/house-markers?regionId=${encodeURIComponent(selectedRegionId)}`)
      if (!res.ok) return
      const data = (await res.json()) as {
        markers: HouseMarkerDTO[]
        apartment_groups: ApartmentGroupOverlay[]
      }
      setMarkers(data.markers)
      setApartmentGroups(data.apartment_groups ?? [])
    }
    loadMarkers()
  }, [selectedRegionId])

  const fitKey = useMemo(() => {
    const r = regionsLocal.find((x) => x.id === selectedRegionId)
    const bk = r?.mapBoundsRing ? JSON.stringify(r.mapBoundsRing) : ""
    return [selectedRegionId ?? "", bk, String(markers.length)].join("|")
  }, [selectedRegionId, regionsLocal, markers.length])

  const lastFitKeyRef = useRef("")
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || editRegionId) return
    if (lastFitKeyRef.current === fitKey) return
    lastFitKeyRef.current = fitKey

    const region = regionsLocal.find((x) => x.id === selectedRegionId)
    const ring = normalizeRing(region?.mapBoundsRing)
    if (ring) {
      map.fitBounds(ringToLngLatBounds(ring) as LngLatBoundsLike, {
        padding: 60,
        duration: 500,
        maxZoom: 17
      })
      return
    }

    if (markers.length === 0) {
      map.flyTo({ center: KONSTANZ_JBS, zoom: 16, duration: 400 })
      return
    }

    const bounds = markers.reduce(
      (acc, m) => {
        acc[0][0] = Math.min(acc[0][0], m.lng)
        acc[0][1] = Math.min(acc[0][1], m.lat)
        acc[1][0] = Math.max(acc[1][0], m.lng)
        acc[1][1] = Math.max(acc[1][1], m.lat)
        return acc
      },
      [
        [markers[0].lng, markers[0].lat],
        [markers[0].lng, markers[0].lat]
      ] as [[number, number], [number, number]]
    )
    map.fitBounds(bounds as LngLatBoundsLike, { padding: 60, duration: 500, maxZoom: 17 })
  }, [fitKey, markers, regionsLocal, selectedRegionId, editRegionId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    void (async () => {
      await upsertHouseMarkerLayer(map, markers)
    })()
  }, [markers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    upsertApartmentGroupLayer(map, apartmentGroups)
  }, [apartmentGroups])

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return
    const map = mapRef.current

    if (!userLocation) {
      removeUserLocationLayer(map)
      void upsertNearbyHouseMarkerLayer(map, [])
      return
    }

    upsertUserLocationLayer(map, userLocation, true)
    void (async () => {
      await upsertNearbyHouseMarkerLayer(map, nearbyMarkers)
      bindHouseMarkerClick(map, (markerId) => {
        if (editModeRef.current) return
        setSelectedMarkerId(markerId)
      })
    })()
  }, [userLocation, nearbyMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    upsertConflictConnectionLayer(map, conflictLineFeatures)
  }, [conflictLineFeatures])

  useEffect(() => {
    if (!editRegionId || !mapRef.current?.isStyleLoaded()) {
      boundsEditorRef.current?.destroy()
      boundsEditorRef.current = null
      return
    }
    const map = mapRef.current
    const region = regionsRef.current.find((r) => r.id === editRegionId)
    const initial = normalizeRing(region?.mapBoundsRing)
    const editor = new RegionBoundsEditor(map, initial, () => {})
    boundsEditorRef.current = editor
    return () => {
      editor.destroy()
      boundsEditorRef.current = null
    }
  }, [editRegionId])

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("当前浏览器不支持定位")
      return
    }

    setGeoError(null)
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null)
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("定位权限被拒绝，请在浏览器设置中允许定位")
        } else {
          setGeoError("定位失败，请稍后重试")
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 8000
      }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  async function updateMarkerStatus(status: DeliveryStatus) {
    if (!selectedMarker) return
    setStatusLoading(true)
    const res = await fetch(`/api/house-markers/${selectedMarker.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    })
    setStatusLoading(false)
    if (!res.ok) return

    setMarkers((prev) =>
      prev.map((m) => (m.id === selectedMarker.id ? { ...m, delivery_status: status } : m))
    )
    setSelectedMarkerId(null)
  }

  async function removeFromPlan() {
    if (!selectedMarker) return
    setStatusLoading(true)
    const res = await fetch(`/api/house-markers/${selectedMarker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_from_plan" })
    })
    setStatusLoading(false)
    if (!res.ok) return

    setMarkers((prev) => prev.filter((m) => m.id !== selectedMarker.id))
    setSelectedMarkerId(null)
  }

  async function updateHousenumber(newNumber: string) {
    if (!selectedMarker) return
    setStatusLoading(true)
    const res = await fetch(`/api/house-markers/${selectedMarker.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "update_housenumber",
        new_housenumber: newNumber
      })
    })
    setStatusLoading(false)
    if (!res.ok) return

    setMarkers((prev) =>
      prev.map((m) =>
        m.id === selectedMarker.id ? { ...m, current_housenumber: newNumber } : m
      )
    )
    setSelectedMarkerId(null)
  }

  function backToMe() {
    if (!mapRef.current || !userLocation) return
    mapRef.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 16,
      duration: 500
    })
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQ.trim()
    if (q.length < 2) return
    setSearchBusy(true)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      if (!res.ok) {
        setSearchHits([])
        return
      }
      const data = (await res.json()) as {
        results: Array<{ lat: number; lng: number; label: string }>
      }
      setSearchHits(data.results ?? [])
    } finally {
      setSearchBusy(false)
    }
  }

  async function saveBounds() {
    if (!editRegionId) return
    const ring = boundsEditorRef.current?.getRing() ?? null
    const res = await fetch(`/api/regions/${editRegionId}/bounds`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapBoundsRing: ring })
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      region: { id: string; mapBoundsRing: MapBoundsRing | null }
    }
    setRegionsLocal((prev) =>
      prev.map((r) =>
        r.id === editRegionId ? { ...r, mapBoundsRing: data.region.mapBoundsRing } : r
      )
    )
    setEditRegionId(null)
    router.refresh()
    lastFitKeyRef.current = ""
  }

  const inEdit = Boolean(editRegionId)

  return (
    <div className="relative h-[calc(100vh-9.5rem)] w-full overflow-hidden rounded-2xl border border-black/10">
      <div ref={mapContainerRef} className="h-full w-full" />

      {inEdit ? (
        <>
          <form
            onSubmit={runSearch}
            className="pointer-events-auto absolute left-3 right-3 top-3 z-40 flex flex-col gap-1"
          >
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="搜索地点…"
              className={[
                "w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm text-black shadow-sm backdrop-blur",
                "bg-white/50 placeholder:text-gray-500",
                "focus:border-black/20 focus:bg-white/80 focus:outline-none"
              ].join(" ")}
            />
            {searchBusy ? (
              <div className="px-1 text-xs text-gray-600">搜索中…</div>
            ) : null}
            {searchHits.length > 0 ? (
              <ul className="max-h-40 overflow-y-auto rounded-xl border border-black/10 bg-white/60 py-1 text-xs shadow-sm backdrop-blur">
                {searchHits.map((h, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-black/5"
                      onClick={() => {
                        mapRef.current?.flyTo({ center: [h.lng, h.lat], zoom: 17, duration: 600 })
                        setSearchHits([])
                        setSearchQ("")
                      }}
                    >
                      {h.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>

          <div className="pointer-events-auto absolute bottom-4 left-3 z-40">
            <button
              type="button"
              onClick={() => boundsEditorRef.current?.addRectangle()}
              className={[
                "flex h-11 w-11 items-center justify-center rounded-xl border border-black/10",
                "bg-white/50 shadow-sm backdrop-blur"
              ].join(" ")}
              aria-label="框选区域"
            >
              <AreaToolIcon />
            </button>
          </div>

          <div className="pointer-events-auto absolute bottom-4 left-1/2 z-40 w-[min(92vw,340px)] -translate-x-1/2">
            <button
              type="button"
              onClick={() => void saveBounds()}
              className={[
                "w-full rounded-xl border border-white/30 px-4 py-3 text-center text-sm font-medium text-white shadow-sm backdrop-blur",
                "bg-green-600/50 hover:bg-green-600/60"
              ].join(" ")}
            >
              保存当前设置
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-start justify-between gap-2">
            <div className="pointer-events-auto flex flex-col gap-2">
              <RegionSwitcher
                regions={regionsLocal}
                selectedRegionId={selectedRegionId}
                onChange={(regionId) => {
                  setSelectedRegionId(regionId)
                  lastFitKeyRef.current = ""
                  router.push(`/map?regionId=${encodeURIComponent(regionId)}`)
                }}
              />
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className={[
                  "flex h-11 w-11 items-center justify-center rounded-xl border border-black/10",
                  "bg-white/50 shadow-sm backdrop-blur"
                ].join(" ")}
                aria-label="管理区域"
              >
                <RegionListIcon />
              </button>
            </div>
            <div className="pointer-events-auto w-[min(240px,calc(100vw-7rem))]">
              <StatsCard markers={markers} />
            </div>
          </div>

          {nextMarker ? (
            <div className="pointer-events-none absolute left-3 top-[7.5rem] z-30 rounded-xl bg-green-600 px-3 py-2 text-white shadow-sm">
              <div className="text-[11px] opacity-90">下一个投递门牌</div>
              <div className="text-lg font-bold">{nextMarker.marker.current_housenumber}</div>
            </div>
          ) : null}

          {geoError ? (
            <div
              className={`pointer-events-none absolute left-3 right-3 top-[7.5rem] z-30 rounded-xl p-2 text-xs text-red-600 shadow-sm backdrop-blur ${glassPanel}`}
            >
              {geoError}
            </div>
          ) : null}

          {userLocation ? (
            <div className="pointer-events-auto absolute bottom-24 right-3 z-30">
              <button
                type="button"
                onClick={backToMe}
                className={[
                  "rounded-xl border border-black/10 bg-white/50 px-3 py-2 text-sm text-black shadow-sm backdrop-blur"
                ].join(" ")}
              >
                回到我的位置
              </button>
            </div>
          ) : null}

          <div className="pointer-events-auto absolute bottom-24 left-3 z-30">
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="rounded-xl border border-black/10 bg-white/50 px-3 py-2 text-sm text-black shadow-sm backdrop-blur"
            >
              i 今日信息
            </button>
          </div>

          {showInfo ? (
            <div className="pointer-events-none absolute bottom-36 left-3 z-30 rounded-xl border border-black/10 bg-white/50 p-3 text-xs text-black shadow-sm backdrop-blur">
              <div>今天已投递：{markers.filter((m) => m.delivery_status === "delivered").length}</div>
              <div>
                今天应投递：{markers.filter((m) => m.delivery_status !== "blocked").length}
              </div>
            </div>
          ) : null}

          <div className="pointer-events-auto absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
            <button
              type="button"
              onClick={() => setDeliveryActive((v) => !v)}
              className={[
                "flex items-center gap-1 rounded-[8px] px-4 py-2 text-sm shadow-sm",
                "border border-black/10",
                deliveryActive ? "bg-red-600 text-white" : "bg-green-600 text-white"
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-base leading-none">
                {deliveryActive ? "pause" : "play_arrow"}
              </span>
              {deliveryActive ? "停止投递" : "开始投递"}
            </button>
          </div>

          <MarkerActionSheet
            marker={selectedMarker}
            open={Boolean(selectedMarker)}
            loading={statusLoading}
            onClose={() => setSelectedMarkerId(null)}
            onSetStatus={updateMarkerStatus}
            onRemoveFromPlan={removeFromPlan}
            onUpdateHousenumber={updateHousenumber}
          />
        </>
      )}

      <RegionManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onEditRegion={(id) => {
          setSelectedRegionId(id)
          router.push(`/map?regionId=${encodeURIComponent(id)}`)
          setEditRegionId(id)
        }}
        onRegionsUpdated={(next) => {
          setRegionsLocal(next)
          router.refresh()
        }}
      />
    </div>
  )
}
