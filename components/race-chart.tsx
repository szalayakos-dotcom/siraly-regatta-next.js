'use client'

import { useEffect, useRef, useState } from 'react'
import { Panel } from './panel'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'

type CP = { name: string; lat: number; lng: number; type: string; order: number }
type Boat = {
  id: string; name: string; lat: number; lng: number; cp: number
  speedKn: number; heading: number; isMine: boolean; pos: number
  boatName: string; boatClass: string
}
type View = 'map' | 'linear' | 'tactical'

const CLASS_MAP: Record<string, string> = {
  '9g4us1y1ye7afym': 'Ys.I', '40t0bopld7pwwo4': 'Ys.II', 'lgtakoks0p1jnvd': 'Ys.III',
}

// Egyszerűsített Balaton-körvonal [lng, lat], óramutató szerint DNy-ról indulva
const BALATON: [number, number][] = [
  [17.245, 46.713], [17.30, 46.700], [17.45, 46.710], [17.58, 46.735],
  [17.70, 46.760], [17.85, 46.810], [17.98, 46.870], [18.06, 46.920],
  [18.12, 46.975], [18.145, 47.020],
  [18.10, 47.030], [18.00, 46.995], [17.92, 46.960], [17.89, 46.930],
  [17.875, 46.905], [17.86, 46.925], [17.82, 46.950], [17.74, 46.920],
  [17.62, 46.870], [17.50, 46.825], [17.38, 46.790], [17.30, 46.770],
  [17.255, 46.745],
]

const LAT_MID = 46.89
const KX = Math.cos((LAT_MID * Math.PI) / 180)

function distLL(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = (a.lng - b.lng) * KX
  const dy = a.lat - b.lat
  return Math.hypot(dx, dy)
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function RaceChart() {
  const { raceId } = useRace()
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<View>('map')
  const [cps, setCps] = useState<CP[]>([])
  const [boats, setBoats] = useState<Boat[]>([])
  const [following, setFollowing] = useState(false)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const LRef = useRef<any>(null)
  const cpLayerRef = useRef<any>(null)
  const boatLayerRef = useRef<any>(null)
  const followingRef = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  // ===== ADAT: pálya + hajók (state-be), élő frissítéssel =====
  useEffect(() => {
    if (!mounted || !raceId) return
    const pb = getPocketBase()
    let unsub: (() => void) | undefined
    let active = true

    async function loadCps() {
      try {
        const race = await pb.collection('races').getOne(raceId)
        if (race.course_id) {
          const course = await pb.collection('courses').getOne(race.course_id)
          const points = typeof course.points === 'string' ? JSON.parse(course.points || '[]') : (course.points || [])
          const main = points
            .filter((p: any) => p.type === 'start' || p.type === 'checkpoint' || p.type === 'finish')
            .sort((a: any, b: any) => a.order - b.order)
          if (active) setCps(main)
        }
      } catch {}
    }

    async function loadBoats() {
      try {
        const positions = await pb.collection('race_positions').getFullList({ filter: `race_id="${raceId}"` })
        const myId = pb.authStore.record?.id
        const sorted = [...positions].sort((a: any, b: any) =>
          (b.cp_index || 0) - (a.cp_index || 0) || (b.speed_kmh || 0) - (a.speed_kmh || 0)
        )
        const out: Boat[] = await Promise.all(positions.map(async (pos: any) => {
          let name = 'Versenyző', boatName = '—', boatClass = '—'
          try { const u = await pb.collection('users').getOne(pos.player_id); name = u.name || u.email || 'Versenyző' } catch {}
          try {
            const pr = await pb.collection('player_races').getFirstListItem(`race_id="${raceId}" && player_id="${pos.player_id}"`)
            const boat = await pb.collection('boats').getOne(pr.boat_id)
            boatName = boat.name || '—'; boatClass = CLASS_MAP[boat.class_id] || '—'
          } catch {}
          return {
            id: pos.player_id, name, lat: Number(pos.lat), lng: Number(pos.lng),
            cp: pos.cp_index || 0, speedKn: Math.round((pos.speed_kmh || 0) * 0.539957 * 10) / 10,
            heading: pos.heading_deg || 0, isMine: pos.player_id === myId,
            pos: sorted.findIndex((p: any) => p.player_id === pos.player_id) + 1,
            boatName, boatClass,
          }
        }))
        if (active) setBoats(out)
      } catch (e) { console.error('[RaceChart] boats:', e) }
    }

    loadCps(); loadBoats()
    pb.collection('race_positions').subscribe('*', () => loadBoats()).then((u: any) => { unsub = u }).catch(() => {})
    return () => { active = false; if (unsub) try { unsub() } catch {} }
  }, [mounted, raceId])

  // ===== LEAFLET: csak Normál nézetben =====
  useEffect(() => {
    if (!mounted || view !== 'map' || !mapRef.current || mapInstanceRef.current) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !mapRef.current || mapInstanceRef.current) return
      const map = L.map(mapRef.current, { center: [46.88, 17.78], zoom: 11, zoomControl: true, attributionControl: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { opacity: 0.85 }).addTo(map)
      LRef.current = L; mapInstanceRef.current = map
      cpLayerRef.current = L.layerGroup().addTo(map)
      boatLayerRef.current = L.layerGroup().addTo(map)
      drawCpsLeaflet(); drawBoatsLeaflet()
    })()
    return () => {
      cancelled = true
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
      LRef.current = null; cpLayerRef.current = null; boatLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, view])

  // Leaflet markerek frissítése adatváltozáskor
  useEffect(() => {
    if (view === 'map' && mapInstanceRef.current) { drawCpsLeaflet(); drawBoatsLeaflet() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boats, cps, view])

  function drawCpsLeaflet() {
    const L = LRef.current, layer = cpLayerRef.current
    if (!L || !layer) return
    layer.clearLayers()
    cps.forEach((cp) => {
      const color = cp.type === 'start' ? '#c42b1c' : cp.type === 'finish' ? '#c8a030' : '#2a6a7a'
      const icon = L.divIcon({
        html: `<div style="background:${color};color:#fff;font-size:9px;padding:2px 5px;font-family:sans-serif;font-weight:700;white-space:nowrap;box-shadow:1px 1px 4px rgba(0,0,0,0.4)">${cp.name}</div>`,
        className: '', iconAnchor: [0, 0],
      })
      L.marker([cp.lat, cp.lng], { icon }).addTo(layer)
    })
    if (cps.length > 1) {
      L.polyline(cps.map((c) => [c.lat, c.lng] as [number, number]), { color: '#c42b1c', weight: 2, opacity: 0.5, dashArray: '6 5' }).addTo(layer)
    }
  }

  function drawBoatsLeaflet() {
    const L = LRef.current, layer = boatLayerRef.current, map = mapInstanceRef.current
    if (!L || !layer) return
    layer.clearLayers()
    boats.forEach((b) => {
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return
      const size = b.isMine ? 32 : 22
      const tooltip = `
        <div style="font-family:sans-serif;min-width:140px;line-height:1.5">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">${b.isMine ? '⛵ Te' : '⛵ ' + b.name}</div>
          <div style="font-size:11px;color:#666">${b.boatName} · ${b.boatClass}</div>
          <div style="font-size:11px;margin-top:4px">
            <span style="color:#c42b1c;font-weight:700">#${b.pos}</span>
            <span style="color:#666;margin-left:8px">${b.speedKn} kn</span>
            <span style="color:#666;margin-left:8px">CP ${b.cp}</span>
          </div>
        </div>`
      const icon = L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;background:${b.isMine ? '#c42b1c' : '#2a6a7a'};border:2px solid ${b.isMine ? '#c8a030' : 'rgba(255,255,255,0.4)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${b.isMine ? 15 : 11}px;box-shadow:0 2px 6px rgba(0,0,0,0.5)">⛵</div>`,
        className: '', iconAnchor: [size / 2, size / 2],
      })
      const m = L.marker([b.lat, b.lng], { icon }).addTo(layer)
      m.bindTooltip(tooltip, { direction: 'top', offset: [0, -size / 2], opacity: 0.95 })
      if (b.isMine && followingRef.current && map) map.panTo([b.lat, b.lng])
    })
  }

  function toggleFollow() {
    const n = !following
    setFollowing(n); followingRef.current = n
    if (n && mapInstanceRef.current) {
      const me = boats.find((b) => b.isMine)
      if (me) mapInstanceRef.current.panTo([me.lat, me.lng])
    }
  }

  // ===== Nézetváltó (Panel fejléc) =====
  const switcher = (
    <div className="flex gap-0.5 rounded-[4px] border border-border bg-[oklch(0.92_0.01_92)] p-0.5">
      {([['map', 'Normál'], ['linear', 'Lineáris'], ['tactical', 'Taktikai']] as [View, string][]).map(([v, label]) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className="label-caps rounded-[3px] px-2 py-0.5 text-[9px] leading-none transition-colors"
          style={{
            background: view === v ? 'var(--secondary)' : 'transparent',
            color: view === v ? 'var(--secondary-foreground)' : 'var(--muted-foreground)',
            fontWeight: 700,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <Panel title="Balaton — Élő Térkép" code="MAP" bodyClassName="p-0 overflow-hidden" action={switcher}>
      <div style={{ position: 'relative', height: '360px' }}>
        {view === 'map' && (
          <>
            <div ref={mapRef} style={{ height: '360px', width: '100%' }} />
            <button
              onClick={toggleFollow}
              style={{
                position: 'absolute', bottom: '40px', right: '12px', zIndex: 1000,
                background: following ? 'var(--secondary)' : 'var(--card)',
                color: following ? 'var(--secondary-foreground)' : 'var(--foreground)',
                border: '1px solid var(--border)', borderRadius: '4px',
                padding: '6px 12px', fontFamily: 'var(--font-heading)',
                fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
                cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
            >
              {following ? '⛵ KÖVETÉS BE' : '⛵ KÖVETÉS'}
            </button>
          </>
        )}
        {view === 'linear' && <LinearView cps={cps} boats={boats} />}
        {view === 'tactical' && <TacticalView cps={cps} boats={boats} />}
      </div>
    </Panel>
  )
}

/* ============================ LINEÁRIS NÉZET ============================ */
function LinearView({ cps, boats }: { cps: CP[]; boats: Boat[] }) {
  const W = 800, H = 320, x0 = 70, x1 = 730, yBase = 200
  const n = cps.length
  const xOf = (i: number) => (n <= 1 ? (x0 + x1) / 2 : lerp(x0, x1, i / (n - 1)))

  function boatX(b: Boat): number {
    if (n < 2) return (x0 + x1) / 2
    const c = Math.max(0, Math.min(n - 1, b.cp))
    if (c >= n - 1) return xOf(n - 1)
    const segLen = distLL(cps[c], cps[c + 1]) || 1
    const f = clamp01(distLL({ lat: b.lat, lng: b.lng }, cps[c]) / segLen)
    return lerp(xOf(c), xOf(c + 1), f)
  }

  const ranked = [...boats].sort((a, b) => a.pos - b.pos)

  return (
    <div style={{ position: 'relative', height: '360px', width: '100%', background: 'linear-gradient(180deg, oklch(0.17 0.04 172), oklch(0.13 0.035 172))' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0.08 0.03 172 / 0.4) 2px, oklch(0.08 0.03 172 / 0.4) 3px)' }} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="lvGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <text x={x0} y={36} fill="oklch(0.6 0.1 165)" fontFamily="ui-monospace, monospace" fontSize="11" letterSpacing="2">PÁLYA · LINEÁRIS PROFIL</text>

        {/* alapvonal */}
        <line x1={x0} y1={yBase} x2={x1} y2={yBase} stroke="oklch(0.5 0.1 165 / 0.5)" strokeWidth="2" strokeDasharray="2 4" />

        {/* CP csomópontok */}
        {cps.map((cp, i) => {
          const x = xOf(i)
          const isStart = cp.type === 'start', isFinish = cp.type === 'finish'
          const col = isStart ? 'oklch(0.7 0.18 28)' : isFinish ? 'oklch(0.82 0.14 78)' : 'oklch(0.85 0.18 162)'
          return (
            <g key={i} filter="url(#lvGlow)">
              <line x1={x} y1={yBase - 14} x2={x} y2={yBase + 14} stroke={col} strokeWidth="2" />
              <circle cx={x} cy={yBase} r="6" fill="none" stroke={col} strokeWidth="2" />
              <circle cx={x} cy={yBase} r="2.5" fill={col} />
              <text x={x} y={yBase + 34} fill={col} fontFamily="ui-monospace, monospace" fontSize="11" textAnchor="middle" fontWeight="700">{cp.name}</text>
              <text x={x} y={yBase - 24} fill="oklch(0.55 0.08 165)" fontFamily="ui-monospace, monospace" fontSize="9" textAnchor="middle">
                {isStart ? 'RAJT' : isFinish ? 'CÉL' : `CP${i}`}
              </text>
            </g>
          )
        })}

        {/* hajók */}
        {ranked.map((b, idx) => {
          if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return null
          const x = boatX(b)
          const y = yBase - 60 - (idx % 3) * 30
          const col = b.isMine ? 'oklch(0.85 0.16 78)' : 'oklch(0.78 0.16 162)'
          return (
            <g key={b.id} filter="url(#lvGlow)">
              <line x1={x} y1={y + 10} x2={x} y2={yBase - 4} stroke={col} strokeWidth="1" strokeOpacity="0.5" />
              <polygon points={`${x},${y - 9} ${x - 7},${y + 7} ${x + 7},${y + 7}`} fill={col} />
              {b.isMine && <circle cx={x} cy={y} r="14" fill="none" stroke={col} strokeWidth="1.5" strokeDasharray="3 3" />}
              <text x={x} y={y - 16} fill={col} fontFamily="ui-monospace, monospace" fontSize="10" textAnchor="middle" fontWeight={b.isMine ? 700 : 400}>
                {b.isMine ? 'TE' : b.name.slice(0, 8)}
              </text>
              <text x={x} y={y + 20} fill="oklch(0.6 0.09 165)" fontFamily="ui-monospace, monospace" fontSize="8" textAnchor="middle">#{b.pos} · {b.speedKn}kn</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ============================ TAKTIKAI CRT NÉZET ============================ */
function TacticalView({ cps, boats }: { cps: CP[]; boats: Boat[] }) {
  const W = 800, H = 420, pad = 46
  const CYAN = 'oklch(0.82 0.13 200)'
  const CYAN_DIM = 'oklch(0.6 0.1 200)'
  const CYAN_FAINT = 'oklch(0.5 0.09 200 / 0.35)'

  // projekció: Balaton bbox → viewBox, arányhelyesen
  const raw = BALATON.map(([lng, lat]) => [lng * KX, lat] as [number, number])
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const bw = maxX - minX || 1, bh = maxY - minY || 1
  const scale = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh)
  const offX = (W - bw * scale) / 2, offY = (H - bh * scale) / 2
  const project = (lng: number, lat: number): [number, number] => [
    offX + (lng * KX - minX) * scale,
    H - (offY + (lat - minY) * scale), // y tükrözve (észak fent)
  ]

  const coast = BALATON.map(([lng, lat]) => project(lng, lat))
  const coastPath = coast.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z'

  const me = boats.find((b) => b.isMine)
  const meXY = me && Number.isFinite(me.lat) ? project(me.lng, me.lat) : null

  // rács
  const gridV = Array.from({ length: 7 }, (_, i) => pad + ((W - pad * 2) * i) / 6)
  const gridH = Array.from({ length: 5 }, (_, i) => pad + ((H - pad * 2) * i) / 4)

  return (
    <div style={{ position: 'relative', height: '360px', width: '100%', background: 'radial-gradient(120% 90% at 50% 0%, oklch(0.22 0.06 205 / 0.5), transparent 70%), linear-gradient(180deg, oklch(0.16 0.045 210), oklch(0.11 0.035 212))' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0.05 0.02 210 / 0.45) 2px, oklch(0.05 0.02 210 / 0.45) 3px)' }} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="tvGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* koordináta-rács */}
        {gridV.map((x, i) => <line key={'v' + i} x1={x} y1={pad} x2={x} y2={H - pad} stroke={CYAN_FAINT} strokeWidth="0.6" />)}
        {gridH.map((y, i) => <line key={'h' + i} x1={pad} y1={y} x2={W - pad} y2={y} stroke={CYAN_FAINT} strokeWidth="0.6" />)}
        <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="none" stroke={CYAN_DIM} strokeWidth="1" />

        {/* Balaton körvonal */}
        <path d={coastPath} fill="oklch(0.4 0.08 200 / 0.10)" stroke={CYAN} strokeWidth="1.6" strokeLinejoin="round" filter="url(#tvGlow)" />
        <text x={W / 2} y={H / 2 + 6} fill={CYAN_FAINT} fontFamily="ui-monospace, monospace" fontSize="22" letterSpacing="10" textAnchor="middle" opacity="0.5">BALATON</text>

        {/* CP-k */}
        {cps.map((cp, i) => {
          if (!Number.isFinite(cp.lat)) return null
          const [x, y] = project(cp.lng, cp.lat)
          return (
            <g key={i} filter="url(#tvGlow)">
              <path d={`M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6} L${x - 6} ${y} Z`} fill="none" stroke={CYAN} strokeWidth="1.4" />
              <rect x={x + 9} y={y - 9} width={cp.name.length * 6.5 + 8} height="15" fill="oklch(0.18 0.05 210 / 0.85)" stroke={CYAN_DIM} strokeWidth="0.7" />
              <text x={x + 13} y={y + 2} fill={CYAN} fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700">{cp.name}</text>
            </g>
          )
        })}

        {/* hajók */}
        {boats.map((b) => {
          if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return null
          const [x, y] = project(b.lng, b.lat)
          if (b.isMine) {
            return (
              <g key={b.id} filter="url(#tvGlow)">
                <circle cx={x} cy={y} r="13" fill="none" stroke={CYAN} strokeWidth="1.4" />
                <rect x={x - 4} y={y - 4} width="8" height="8" fill={CYAN} />
                <rect x={x + 16} y={y - 9} width="34" height="15" fill="oklch(0.22 0.07 205)" stroke={CYAN} strokeWidth="0.8" />
                <text x={x + 20} y={y + 2} fill="oklch(0.95 0.06 200)" fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700">TE</text>
              </g>
            )
          }
          return (
            <g key={b.id} filter="url(#tvGlow)">
              <rect x={x - 3} y={y - 3} width="6" height="6" fill={CYAN_DIM} />
              <text x={x} y={y - 8} fill={CYAN_DIM} fontFamily="ui-monospace, monospace" fontSize="8" textAnchor="middle">{b.name.slice(0, 6)}</text>
            </g>
          )
        })}

        {/* fejléc LCD-k (mint a referencia) */}
        <text x={pad} y={28} fill={CYAN_DIM} fontFamily="ui-monospace, monospace" fontSize="11" letterSpacing="2">NAVIGÁCIÓ</text>
        <g fontFamily="ui-monospace, monospace" fontSize="11">
          <text x={W - 260} y={22} fill={CYAN_DIM}>Lat:</text>
          <rect x={W - 228} y={12} width="76" height="14" fill="oklch(0.2 0.06 205)" stroke={CYAN_DIM} strokeWidth="0.7" />
          <text x={W - 224} y={23} fill={CYAN}>{meXY ? me!.lat.toFixed(4) : '——.————'}</text>
          <text x={W - 142} y={22} fill={CYAN_DIM}>N</text>
          <text x={W - 260} y={40} fill={CYAN_DIM}>Lng:</text>
          <rect x={W - 228} y={30} width="76" height="14" fill="oklch(0.2 0.06 205)" stroke={CYAN_DIM} strokeWidth="0.7" />
          <text x={W - 224} y={41} fill={CYAN}>{meXY ? me!.lng.toFixed(4) : '——.————'}</text>
          <text x={W - 142} y={40} fill={CYAN_DIM}>E</text>
        </g>
      </svg>
    </div>
  )
}
