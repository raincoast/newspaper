"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FeatureCollection } from "geojson"
import maplibregl, { type LngLatBoundsLike, type Map } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

import DeliveryFocusSheet from "./DeliveryFocusSheet"
import DeliveryPointPickerSheet from "./DeliveryPointPickerSheet"
import MarkerActionSheet from "./MarkerActionSheet"
import { MAP_GLASS_PANEL } from "./mapGlass"
import RegionManageModal from "./RegionManageModal"
import RegionSwitcher from "./RegionSwitcher"
import StatsCard from "./StatsCard"
import StreetRulesModal from "./StreetRulesModal"
import {
  bringStreetBrowseLayersToTop,
  removeStreetBrowseOverlay,
  STREET_BROWSE_CLICK_LAYERS,
  STREET_BROWSE_HIT_TOP_LAYER,
  STREET_BROWSE_SYMBOL_LAYER,
  upsertStreetBrowseOverlay
} from "./StreetBrowseLayer"
import { buildStreetFallbackFromMarkers, mergeStreetNameFeatures } from "../../lib/map/streetFallbackGeojson"
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

/** Jacob-Burckhardt-Straße 4 一带（OSM 建筑坐标） */
const KONSTANZ_JBS: [number, number] = [9.184665, 47.6815884]

const iconBtn =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/50 text-gray-900 shadow-sm backdrop-blur"

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

type MarkerSheet = "none" | "focus" | "actions"

export default function MapView({
  regions,
  initialRegionId,
  isAdmin = false,
  guestMode = false
}: {
  regions: RegionLite[]
  initialRegionId: string | null
  isAdmin?: boolean
  guestMode?: boolean
}) {
  const router = useRouter()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)

  const [regionsLocal, setRegionsLocal] = useState<RegionLite[]>(regions)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialRegionId)
  const [markers, setMarkers] = useState<HouseMarkerDTO[]>([])
  const [apartmentGroups, setApartmentGroups] = useState<ApartmentGroupOverlay[]>([])
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [markerSheet, setMarkerSheet] = useState<MarkerSheet>("none")
  const [statusLoading, setStatusLoading] = useState(false)
  const [focusLoading, setFocusLoading] = useState(false)

  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
    accuracy?: number | null
  } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [deliveryActive, setDeliveryActive] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const [manageOpen, setManageOpen] = useState(false)
  const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false)
  const [streetBrowseMode, setStreetBrowseMode] = useState(false)
  const [streetBrowseLoading, setStreetBrowseLoading] = useState(false)
  const [streetBrowseError, setStreetBrowseError] = useState<string | null>(null)
  const [streetBrowseStreets, setStreetBrowseStreets] = useState<FeatureCollection | null>(null)
  const [streetBrowseNeedRingTip, setStreetBrowseNeedRingTip] = useState(false)
  const [noDeliveryPointsTip, setNoDeliveryPointsTip] = useState(false)
  const [resetMenuOpen, setResetMenuOpen] = useState(false)
  const [streetRulesStreet, setStreetRulesStreet] = useState<string | null>(null)
  const [rulePreviewIds, setRulePreviewIds] = useState<Set<string>>(() => new Set())
  const [editRegionId, setEditRegionId] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState("")
  const [searchHits, setSearchHits] = useState<
    Array<{ lat: number; lng: number; label: string }>
  >([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const geoWatchIdRef = useRef<number | null>(null)

  const editModeRef = useRef<string | null>(null)
  const streetBrowseModeRef = useRef(false)
  const deliveryActiveRef = useRef(false)
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

  useEffect(() => {
    deliveryActiveRef.current = deliveryActive
  }, [deliveryActive])

  useEffect(() => {
    streetBrowseModeRef.current = streetBrowseMode
  }, [streetBrowseMode])

  const selectedMarker = useMemo(
    () => markers.find((m) => m.id === selectedMarkerId) ?? null,
    [markers, selectedMarkerId]
  )

  const markersOnStreet = useMemo(() => {
    if (!streetRulesStreet) return []
    return markers.filter((m) => m.street_name === streetRulesStreet)
  }, [markers, streetRulesStreet])

  const streetBrowseDisplayFc = useMemo(() => {
    if (!streetBrowseStreets || !streetBrowseMode) return null
    const region = regionsLocal.find((r) => r.id === selectedRegionId)
    const ring = normalizeRing(region?.mapBoundsRing)
    if (!ring) return streetBrowseStreets
    const fb = buildStreetFallbackFromMarkers(markers, ring)
    return mergeStreetNameFeatures(streetBrowseStreets, fb)
  }, [streetBrowseStreets, streetBrowseMode, regionsLocal, selectedRegionId, markers])

  const markersForLayer = useMemo(() => {
    return markers.map((m) => ({
      ...m,
      rule_highlight: Boolean(
        m.is_selected_by_rule ||
          (streetRulesStreet &&
            m.street_name === streetRulesStreet &&
            rulePreviewIds.has(m.id))
      )
    }))
  }, [markers, streetRulesStreet, rulePreviewIds])

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

  function closeMarkerSheets() {
    setSelectedMarkerId(null)
    setMarkerSheet("none")
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
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

    map.on("load", () => {
      upsertHouseMarkerLayer(map, [])
      setMapReady(true)
    })

    mapRef.current = map

    return () => {
      if (!mapRef.current) return
      setMapReady(false)
      boundsEditorRef.current?.destroy()
      boundsEditorRef.current = null
      removeStreetBrowseOverlay(mapRef.current)
      removeUserLocationLayer(mapRef.current)
      removeHouseMarkerLayer(mapRef.current)
      mapRef.current.remove()
      mapRef.current = null
    }
  }, [])

  const loadMarkersForRegion = useCallback(async () => {
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
    const normalized = (data.markers ?? []).map((m) => ({
      ...m,
      excluded_recipient_names: Array.isArray(m.excluded_recipient_names)
        ? m.excluded_recipient_names
        : [],
      is_delivery_focus: Boolean(m.is_delivery_focus),
      is_manually_added: Boolean(m.is_manually_added),
      is_number_overridden: Boolean(m.is_number_overridden)
    }))
    let merged = normalized
    if (guestMode && selectedRegionId && typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`guest-delivery-focus:${selectedRegionId}`)
      if (stored) {
        merged = normalized.map((m) => ({
          ...m,
          is_delivery_focus: m.id === stored
        }))
      }
    }
    setMarkers(merged)
    setApartmentGroups(data.apartment_groups ?? [])
  }, [selectedRegionId, guestMode])

  useEffect(() => {
    void loadMarkersForRegion()
  }, [loadMarkersForRegion])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !mapReady) return
    bindHouseMarkerClick(map, (markerId) => {
      if (editModeRef.current || streetBrowseModeRef.current) return
      setSelectedMarkerId(markerId)
      setMarkerSheet(deliveryActiveRef.current ? "actions" : "focus")
    })
  }, [mapReady, markers, nearbyMarkers, userLocation, streetBrowseMode])

  useEffect(() => {
    if (streetBrowseMode) return
    setStreetBrowseStreets(null)
    setStreetBrowseError(null)
    setStreetBrowseLoading(false)
  }, [streetBrowseMode])

  useEffect(() => {
    if (!streetBrowseNeedRingTip) return
    const t = setTimeout(() => setStreetBrowseNeedRingTip(false), 4200)
    return () => clearTimeout(t)
  }, [streetBrowseNeedRingTip])

  useEffect(() => {
    if (!noDeliveryPointsTip) return
    const t = setTimeout(() => setNoDeliveryPointsTip(false), 4200)
    return () => clearTimeout(t)
  }, [noDeliveryPointsTip])

  useEffect(() => {
    if (!streetBrowseMode || !mapReady || !selectedRegionId) return
    const region = regionsLocal.find((r) => r.id === selectedRegionId)
    const ring = normalizeRing(region?.mapBoundsRing)
    if (!ring) return

    let cancelled = false
    setStreetBrowseLoading(true)
    setStreetBrowseError(null)
    setStreetBrowseStreets(null)

    void (async () => {
      try {
        const res = await fetch("/api/osm-streets-in-region", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ring })
        })
        const data = (await res.json()) as { geojson?: FeatureCollection; error?: string }
        if (cancelled) return
        if (!res.ok) {
          setStreetBrowseError(data.error ?? "无法加载道路数据")
          setStreetBrowseStreets(null)
          return
        }
        setStreetBrowseStreets(data.geojson ?? { type: "FeatureCollection", features: [] })
      } catch {
        if (!cancelled) {
          setStreetBrowseError("无法加载道路数据")
          setStreetBrowseStreets(null)
        }
      } finally {
        if (!cancelled) setStreetBrowseLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [streetBrowseMode, mapReady, selectedRegionId, regionsLocal])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !mapReady) return
    const region = regionsLocal.find((r) => r.id === selectedRegionId)
    const ring = normalizeRing(region?.mapBoundsRing)
    upsertStreetBrowseOverlay(map, {
      active: streetBrowseMode,
      ring: streetBrowseMode ? ring : null,
      streets: streetBrowseDisplayFc ?? streetBrowseStreets
    })
  }, [streetBrowseMode, streetBrowseStreets, streetBrowseDisplayFc, selectedRegionId, regionsLocal, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !mapReady || !streetBrowseMode) return
    bringStreetBrowseLayersToTop(map)
  }, [streetBrowseMode, mapReady, markersForLayer, nearbyMarkers, streetBrowseDisplayFc])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !mapReady || !streetBrowseMode) return

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!streetBrowseModeRef.current) return
      const layers = [...STREET_BROWSE_CLICK_LAYERS].filter((id) => Boolean(map.getLayer(id)))
      if (layers.length === 0) return
      const feats = map.queryRenderedFeatures(e.point, { layers })
      const f = feats.find((x) => {
        const n = x.properties?.name
        return typeof n === "string" && n.trim().length > 0
      })
      if (!f || typeof f.properties?.name !== "string") return
      setStreetRulesStreet(f.properties.name.trim())
    }

    map.on("click", onClick)
    return () => {
      map.off("click", onClick)
    }
  }, [streetBrowseMode, mapReady, streetBrowseStreets])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !mapReady || !streetBrowseMode) return
    const layers = [STREET_BROWSE_HIT_TOP_LAYER, STREET_BROWSE_SYMBOL_LAYER].filter((id) =>
      Boolean(map.getLayer(id))
    )
    if (layers.length === 0) return

    const enter = () => {
      map.getCanvas().style.cursor = "pointer"
    }
    const leave = () => {
      map.getCanvas().style.cursor = ""
    }
    for (const id of layers) {
      map.on("mouseenter", id, enter)
      map.on("mouseleave", id, leave)
    }
    return () => {
      for (const id of layers) {
        map.off("mouseenter", id, enter)
        map.off("mouseleave", id, leave)
      }
      map.getCanvas().style.cursor = ""
    }
  }, [streetBrowseMode, mapReady, streetBrowseStreets])

  const fitKey = useMemo(() => {
    const r = regionsLocal.find((x) => x.id === selectedRegionId)
    const bk = r?.mapBoundsRing ? JSON.stringify(r.mapBoundsRing) : ""
    return [selectedRegionId ?? "", bk, String(markers.length)].join("|")
  }, [selectedRegionId, regionsLocal, markers.length])

  const lastFitKeyRef = useRef("")
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || editRegionId || streetBrowseMode) return
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
  }, [fitKey, markers, regionsLocal, selectedRegionId, editRegionId, streetBrowseMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    upsertHouseMarkerLayer(map, markersForLayer)
  }, [markersForLayer])

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
      upsertNearbyHouseMarkerLayer(map, [])
      return
    }

    upsertUserLocationLayer(map, userLocation, true)
    upsertNearbyHouseMarkerLayer(map, nearbyMarkers)
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

  function applyGeoPosition(pos: GeolocationPosition) {
    setGeoError(null)
    setUserLocation({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    })
  }

  function onGeoError(err: GeolocationPositionError) {
    if (err.code === err.PERMISSION_DENIED) {
      setGeoError("定位权限被拒绝；Safari 无痕请点击「定位」按钮并允许一次")
    } else {
      setGeoError("定位失败，请重试或点击「定位」")
    }
  }

  const geoOpts: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 12_000
  }

  /** 用户点击按钮触发，兼容 Safari 无痕下 watchPosition 不弹窗的问题 */
  function requestLocationFromUser() {
    if (!("geolocation" in navigator)) {
      setGeoError("当前浏览器不支持定位")
      return
    }
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyGeoPosition(pos)
        if (geoWatchIdRef.current === null) {
          geoWatchIdRef.current = navigator.geolocation.watchPosition(
            applyGeoPosition,
            onGeoError,
            geoOpts
          )
        }
      },
      onGeoError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 }
    )
  }

  /** 不在首屏自动 watch：iOS Safari 常在无用户手势时静默失败；请点右下角「定位」触发。 */
  useEffect(() => {
    return () => {
      if (geoWatchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current)
        geoWatchIdRef.current = null
      }
    }
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

    closeMarkerSheets()
    void loadMarkersForRegion()
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
    closeMarkerSheets()
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
    closeMarkerSheets()
  }

  async function saveExcludedRecipientNames(names: string[]) {
    if (!selectedMarker) return
    setStatusLoading(true)
    const res = await fetch(`/api/house-markers/${selectedMarker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_excluded_recipient_names",
        excluded_recipient_names: names
      })
    })
    setStatusLoading(false)
    if (!res.ok) return
    void loadMarkersForRegion()
  }

  async function deleteMarkerPermanently() {
    if (!selectedMarker) return
    if (!window.confirm("确定永久删除此投递点？数据库中将不再保留该门牌。")) return
    setStatusLoading(true)
    const res = await fetch(`/api/house-markers/${selectedMarker.id}`, { method: "DELETE" })
    setStatusLoading(false)
    if (!res.ok) return
    closeMarkerSheets()
    void loadMarkersForRegion()
  }

  async function runResetDelivery(mode: "delivery_status" | "full") {
    if (!selectedRegionId || guestMode) return
    if (mode === "delivery_status") {
      if (
        !window.confirm(
          "将「已投递」门牌恢复为未投递，保留「不让投递」与禁投姓名等设置。确定？"
        )
      ) {
        return
      }
    } else if (
      !window.confirm("将重置所有门牌：清除不让投递、禁投姓名及从计划移除等。确定？")
    ) {
      return
    }
    const res = await fetch(`/api/regions/${selectedRegionId}/reset-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    })
    if (!res.ok) return
    void loadMarkersForRegion()
  }

  function applyLocalDeliveryFocus(markerId: string) {
    setMarkers((prev) =>
      prev.map((m) => ({
        ...m,
        is_delivery_focus: m.id === markerId
      }))
    )
  }

  async function pickDeliveryFocusFromList(markerId: string) {
    if (!selectedRegionId) return
    if (guestMode) {
      try {
        sessionStorage.setItem(`guest-delivery-focus:${selectedRegionId}`, markerId)
      } catch {
        /* ignore quota / private mode */
      }
      applyLocalDeliveryFocus(markerId)
      setDeliveryPickerOpen(false)
      return
    }
    setFocusLoading(true)
    const res = await fetch(`/api/regions/${selectedRegionId}/delivery-focus`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ houseMarkerId: markerId })
    })
    setFocusLoading(false)
    if (!res.ok) return
    applyLocalDeliveryFocus(markerId)
    setDeliveryPickerOpen(false)
  }

  async function setRegionDeliveryFocus() {
    if (!selectedMarker || !selectedRegionId) return
    if (guestMode) {
      try {
        sessionStorage.setItem(`guest-delivery-focus:${selectedRegionId}`, selectedMarker.id)
      } catch {
        /* ignore */
      }
      applyLocalDeliveryFocus(selectedMarker.id)
      closeMarkerSheets()
      return
    }
    setFocusLoading(true)
    const res = await fetch(`/api/regions/${selectedRegionId}/delivery-focus`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ houseMarkerId: selectedMarker.id })
    })
    setFocusLoading(false)
    if (!res.ok) return

    applyLocalDeliveryFocus(selectedMarker.id)
    closeMarkerSheets()
  }

  function backToMe() {
    if (!mapRef.current || !userLocation) return
    mapRef.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 16,
      duration: 500
    })
  }

  async function fetchGeocodeHits(q: string) {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setSearchHits([])
      return
    }
    setSearchBusy(true)
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(trimmed)}&countrycodes=de`
      )
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

  useEffect(() => {
    if (!editRegionId) return
    if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current)
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchHits([])
      return
    }
    geocodeDebounceRef.current = setTimeout(() => {
      void fetchGeocodeHits(q)
    }, 320)
    return () => {
      if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current)
    }
  }, [searchQ, editRegionId])

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQ.trim()
    if (q.length < 2) return
    await fetchGeocodeHits(q)
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

  function cancelEdit() {
    setEditRegionId(null)
    lastFitKeyRef.current = ""
    router.refresh()
  }

  const inEdit = Boolean(editRegionId)

  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {inEdit ? (
        <>
          <form
            onSubmit={runSearch}
            className="pointer-events-auto absolute left-3 right-3 top-3 z-40 flex flex-col gap-1"
          >
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="搜索地点（英文 / 德文，实时提示）"
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

          <div className="pointer-events-auto absolute bottom-3 left-3 z-40 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => boundsEditorRef.current?.addRectangle()}
              className={iconBtn}
              aria-label="框选区域"
            >
              <span className="material-symbols-outlined text-[22px] leading-none">crop_free</span>
            </button>
            <div className="flex max-w-[min(92vw,400px)] flex-row gap-2">
              <button
                type="button"
                onClick={() => void saveBounds()}
                className={[
                  "min-h-12 flex-1 rounded-xl border border-white/30 px-4 py-3 text-center text-sm font-medium text-white shadow-sm backdrop-blur",
                  "bg-green-600/50 hover:bg-green-600/60"
                ].join(" ")}
              >
                保存当前设置
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex h-12 min-w-[4.5rem] shrink-0 items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-medium text-white shadow-sm"
              >
                取消
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-start justify-between gap-2">
            <div className="pointer-events-auto max-w-[min(200px,45vw)]">
              <RegionSwitcher
                regions={regionsLocal}
                selectedRegionId={selectedRegionId}
                onChange={(regionId) => {
                  setSelectedRegionId(regionId)
                  lastFitKeyRef.current = ""
                  router.push(`/map?regionId=${encodeURIComponent(regionId)}`)
                }}
              />
            </div>
            <div className="pointer-events-auto w-[min(220px,calc(100vw-8rem))]">
              <StatsCard markers={markers} />
            </div>
          </div>

          {deliveryActive && nextMarker && !streetBrowseMode ? (
            <div className="pointer-events-none absolute left-3 top-[5.5rem] z-[32] max-w-[min(92vw,280px)] rounded-xl bg-green-600 px-3 py-2.5 text-white shadow-md">
              <div className="text-[11px] opacity-90">当前投递</div>
              <div className="text-base font-bold leading-snug">
                {nextMarker.marker.street_name} {nextMarker.marker.current_housenumber}.
              </div>
              {(nextMarker.marker.excluded_recipient_names?.length ?? 0) > 0 ? (
                <>
                  <hr className="my-2 border-white/40" />
                  <div className="text-[11px] opacity-90">禁投姓名</div>
                  <ul className="mt-1 space-y-0.5 text-sm font-medium">
                    {nextMarker.marker.excluded_recipient_names.map((name) => (
                      <li key={name}>· {name}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}

          {noDeliveryPointsTip ? (
            <div
              className={`pointer-events-none absolute left-3 right-3 top-[5.5rem] z-[33] rounded-xl px-3 py-2 text-center text-xs text-amber-900 ${MAP_GLASS_PANEL}`}
            >
              当前没有投递点，请先设置。
            </div>
          ) : null}

          {geoError ? (
            <div
              className={`pointer-events-none absolute left-3 right-3 top-[5.5rem] z-30 rounded-xl p-2 text-xs text-red-600 ${MAP_GLASS_PANEL}`}
            >
              {geoError}
            </div>
          ) : null}

          {streetBrowseNeedRingTip ? (
            <div
              className={`pointer-events-none absolute left-3 right-3 top-[5.5rem] z-[37] rounded-xl px-3 py-2 text-center text-xs text-amber-900 ${MAP_GLASS_PANEL}`}
            >
              请先用左侧「编辑区域」在地图上框选范围，再使用本功能。
            </div>
          ) : null}

          {streetBrowseMode && !guestMode ? (
            <div
              className={`pointer-events-auto absolute left-3 right-3 top-[5.5rem] z-[38] max-h-[30vh] overflow-hidden sm:left-auto sm:right-3 sm:max-w-sm ${MAP_GLASS_PANEL} rounded-2xl`}
            >
              <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
                <span className="text-xs font-semibold text-gray-900">街道规则 · 地图选街</span>
                <button
                  type="button"
                  onClick={() => {
                    setStreetBrowseMode(false)
                    setStreetRulesStreet(null)
                    setRulePreviewIds(new Set())
                  }}
                  className="rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-black/5"
                >
                  完成
                </button>
              </div>
              <div className="px-3 py-2.5 text-xs leading-relaxed text-gray-600">
                {streetBrowseLoading
                  ? "正在从 OpenStreetMap 加载与区域相交的道路…"
                  : streetBrowseError ??
                    "地图已显示区域范围；与框选区域相交的道路为蓝色加粗路名（带浅色描边）。点击路名或道路可打开规则设置。"}
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col">
            <div className="flex items-end justify-between px-3 pb-2">
              <div className="pointer-events-auto flex flex-col gap-2">
                {!guestMode ? (
                  <div className="relative">
                    <button
                      type="button"
                      className={iconBtn}
                      aria-label="重置投递数据"
                      disabled={!selectedRegionId}
                      onClick={() => {
                        if (!selectedRegionId) return
                        setResetMenuOpen((o) => !o)
                      }}
                    >
                      <span className="material-symbols-outlined text-[22px] leading-none">
                        reset_focus
                      </span>
                    </button>
                    {resetMenuOpen ? (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-[34] cursor-default"
                          aria-label="关闭菜单"
                          onClick={() => setResetMenuOpen(false)}
                        />
                        <div
                          className={`absolute bottom-full left-0 z-[36] mb-2 min-w-[11rem] rounded-xl py-1 text-sm shadow-lg ${MAP_GLASS_PANEL}`}
                        >
                          <button
                            type="button"
                            className="w-full px-3 py-2.5 text-left text-gray-800 hover:bg-black/5"
                            onClick={() => {
                              setResetMenuOpen(false)
                              void runResetDelivery("delivery_status")
                            }}
                          >
                            重置投递状态
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2.5 text-left text-red-700 hover:bg-black/5"
                            onClick={() => {
                              setResetMenuOpen(false)
                              void runResetDelivery("full")
                            }}
                          >
                            重置所有
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {!guestMode ? (
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="快速编辑区域范围"
                    disabled={!selectedRegionId}
                    onClick={() => {
                      if (!selectedRegionId) return
                      setEditRegionId(selectedRegionId)
                    }}
                  >
                    <span className="material-symbols-outlined text-[22px] leading-none">
                      edit_square
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  className={iconBtn}
                  aria-label={guestMode ? "设置投递点" : "街道规则（地图选街）"}
                  onClick={() => {
                    if (guestMode) {
                      setDeliveryPickerOpen(true)
                      return
                    }
                    if (!selectedRegionId) return
                    const region = regionsLocal.find((r) => r.id === selectedRegionId)
                    const ring = normalizeRing(region?.mapBoundsRing)
                    if (!ring) {
                      setStreetBrowseNeedRingTip(true)
                      return
                    }
                    setStreetBrowseMode(true)
                    const map = mapRef.current
                    if (map?.isStyleLoaded()) {
                      map.fitBounds(ringToLngLatBounds(ring) as LngLatBoundsLike, {
                        padding: 52,
                        duration: 550,
                        maxZoom: 19
                      })
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[22px] leading-none">
                    add_location
                  </span>
                </button>

                <div className="relative">
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="账号"
                    onClick={() => setAccountOpen((o) => !o)}
                  >
                    <span className="material-symbols-outlined text-[22px] leading-none">
                      account_circle
                    </span>
                  </button>
                  {accountOpen ? (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-[35] cursor-default"
                        aria-label="关闭菜单"
                        onClick={() => setAccountOpen(false)}
                      />
                      <div
                        className={`absolute bottom-full left-0 z-[36] mb-2 min-w-[10rem] py-1 text-sm shadow-lg ${MAP_GLASS_PANEL} rounded-xl`}
                      >
                        {guestMode ? (
                          <>
                            <Link
                              href="/login"
                              className="block px-3 py-2 text-gray-800 hover:bg-black/5"
                              onClick={() => setAccountOpen(false)}
                            >
                              登录
                            </Link>
                            <Link
                              href="/register"
                              className="block px-3 py-2 text-gray-800 hover:bg-black/5"
                              onClick={() => setAccountOpen(false)}
                            >
                              注册账号
                            </Link>
                          </>
                        ) : (
                          <>
                            {isAdmin ? (
                              <Link
                                href="/admin"
                                className="block px-3 py-2 text-gray-800 hover:bg-black/5"
                                onClick={() => setAccountOpen(false)}
                              >
                                管理后台
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-gray-800 hover:bg-black/5"
                              onClick={() => signOut({ callbackUrl: "/map" })}
                            >
                              退出登录
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>

                {!guestMode ? (
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="区域与地图"
                    onClick={() => setManageOpen(true)}
                  >
                    <span className="material-symbols-outlined text-[22px] leading-none">map</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  className={iconBtn}
                  aria-label="今日信息"
                  onClick={() => setShowInfo((v) => !v)}
                >
                  <span className="material-symbols-outlined text-[22px] leading-none">info</span>
                </button>
              </div>

              <div className="pointer-events-auto flex flex-col gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    if (userLocation) backToMe()
                    else requestLocationFromUser()
                  }}
                  className={iconBtn}
                  aria-label={userLocation ? "回到我的位置" : "请求定位（Safari 无痕请点此）"}
                >
                  <span className="material-symbols-outlined text-[22px] leading-none">
                    location_searching
                  </span>
                </button>
              </div>
            </div>

            <div className="pointer-events-auto flex justify-center px-3 pb-[12px]">
              <button
                type="button"
                onClick={() => {
                  if (deliveryActive) {
                    setDeliveryActive(false)
                    return
                  }
                  if (markers.length === 0) {
                    setNoDeliveryPointsTip(true)
                    return
                  }
                  setDeliveryActive(true)
                }}
                className={[
                  "flex items-center gap-1 rounded-[8px] px-5 py-2.5 text-sm font-medium shadow-sm backdrop-blur",
                  "border border-black/10",
                  deliveryActive
                    ? "bg-red-600/50 text-white"
                    : "bg-green-600/50 text-white"
                ].join(" ")}
              >
                <span className="material-symbols-outlined text-base leading-none">
                  {deliveryActive ? "pause" : "play_arrow"}
                </span>
                {deliveryActive ? "停止投递" : "开始投递"}
              </button>
            </div>
          </div>

          {showInfo ? (
            <div
              className={`pointer-events-none absolute bottom-28 left-3 z-30 rounded-xl p-3 text-xs ${MAP_GLASS_PANEL}`}
            >
              <div>今天已投递：{markers.filter((m) => m.delivery_status === "delivered").length}</div>
              <div>
                今天应投递：{markers.filter((m) => m.delivery_status !== "blocked").length}
              </div>
            </div>
          ) : null}

          <MarkerActionSheet
            marker={selectedMarker}
            open={markerSheet === "actions" && Boolean(selectedMarker)}
            loading={statusLoading}
            onClose={closeMarkerSheets}
            onSetStatus={updateMarkerStatus}
            onRemoveFromPlan={removeFromPlan}
            onUpdateHousenumber={updateHousenumber}
            onSaveExcludedNames={(names) => void saveExcludedRecipientNames(names)}
            onDeleteMarker={() => void deleteMarkerPermanently()}
          />

          <DeliveryFocusSheet
            marker={selectedMarker}
            open={markerSheet === "focus" && Boolean(selectedMarker)}
            loading={focusLoading}
            onClose={closeMarkerSheets}
            onSetDeliveryFocus={() => void setRegionDeliveryFocus()}
          />

          <DeliveryPointPickerSheet
            open={deliveryPickerOpen}
            onClose={() => setDeliveryPickerOpen(false)}
            markers={markers}
            loading={focusLoading}
            onPick={(id) => void pickDeliveryFocusFromList(id)}
          />

          {streetRulesStreet && selectedRegionId && !guestMode ? (
            <StreetRulesModal
              open={Boolean(streetRulesStreet)}
              regionId={selectedRegionId}
              streetName={streetRulesStreet}
              markersOnStreet={markersOnStreet}
              onClose={() => {
                setStreetRulesStreet(null)
                setRulePreviewIds(new Set())
              }}
              onSaved={() => {
                void loadMarkersForRegion()
                setStreetRulesStreet(null)
                setRulePreviewIds(new Set())
              }}
              onPreviewMatchesChange={setRulePreviewIds}
            />
          ) : null}
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
          setSelectedRegionId((cur) => {
            if (cur && !next.some((r) => r.id === cur)) {
              const fid = next[0]?.id ?? null
              if (fid) router.push(`/map?regionId=${encodeURIComponent(fid)}`)
              else router.push("/map")
              return fid
            }
            return cur
          })
          router.refresh()
        }}
      />
    </div>
  )
}
