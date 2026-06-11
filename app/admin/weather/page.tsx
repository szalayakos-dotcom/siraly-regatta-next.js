'use client'

import { useEffect, useState, useRef } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { Wind, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Race { id: string; name: string; status: string; course_id?: string }
interface WeatherSegment {
  id?: string; race_id: string; from_cp_index: number; to_cp_index: number
  name: string; wind_dir: number; wind_speed: number; storm_level: number
}
interface CoursePoint { type: string; lat: number; lng: number; name: string; order: number }

const DIRS = ['É','ÉK','K','DK','D','DNy','Ny','ÉNy']
const dirLabel = (deg: number) => DIRS[Math.round(((deg%360)+360)%360/45)%8]

export default function WeatherPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const overlaysRef = useRef<any[]>([])

  const [races, setRaces] = useState<Race[]>([])
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)
  const [segments, setSegments] = useState<WeatherSegment[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [coursePoints, setCoursePoints] = useState<CoursePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [noCourse, setNoCourse] = useState(false)

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  useEffect(() => {
    getPocketBase().collection('races').getFullList({ sort: '-id' })
      .then(list => setRaces(list as Race[]))
      .catch(() => {})
  }, [])

  async function ensureMap() {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200)
      return
    }
    if (!mapRef.current) return
    const L = (await import('leaflet')).default
    await import('leaflet/dist/leaflet.css')
    const map = L.map(mapRef.current, {
      center: [46.88, 17.78], zoom: 11,
      zoomControl: true, attributionControl: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { opacity: 0.85 }).addTo(map)
    mapInstanceRef.current = map
    setTimeout(() => map.invalidateSize(), 300)
  }

  // Térkép frissítése
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || coursePoints.length === 0) return

    import('leaflet').then(({ default: L }) => {
      markersRef.current.forEach(m => m.remove())
      overlaysRef.current.forEach(o => o.remove())
      markersRef.current = []
      overlaysRef.current = []

      const mainPts = coursePoints
        .filter(p => p.type === 'start' || p.type === 'waypoint' || p.type === 'checkpoint' || p.type === 'finish')
        .sort((a, b) => a.order - b.order)

      // Pontok
      mainPts.forEach((pt, i) => {
        const isStart = pt.type === 'start'
        const isFinish = pt.type === 'finish'
        const isWaypoint = pt.type === 'waypoint'
        const color = isStart ? '#c42b1c' : isFinish ? '#c8a030' : isWaypoint ? '#888' : '#2a6a7a'
        const icon = L.divIcon({
          html: `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${i+1}</div>`,
          className: '', iconAnchor: [15,15],
        })
        const m = L.marker([pt.lat, pt.lng], { icon }).addTo(map)
          .bindTooltip(pt.name, { permanent: true, direction: 'top', offset: [0,-18],
            className: 'bg-white text-xs px-1 py-0.5 rounded shadow' })
        markersRef.current.push(m)
      })

      // Vonalak + szélnyilak szegmensenként
      segments.forEach((seg, idx) => {
        const from = mainPts[seg.from_cp_index]
        const to = mainPts[seg.to_cp_index]
        if (!from || !to) return

        const isSelected = idx === selectedIdx
        const stormColor = seg.storm_level === 2 ? '#c42b1c' : seg.storm_level === 1 ? '#c8a030' : '#2a6a7a'

        // Vonal
        const line = L.polyline([[from.lat, from.lng],[to.lat, to.lng]], {
          color: stormColor, weight: isSelected ? 4 : 2,
          opacity: isSelected ? 0.9 : 0.5, dashArray: isSelected ? undefined : '6 4'
        }).addTo(map)
        overlaysRef.current.push(line)

        // Szélnyíl közepén SVG overlay
        const midLat = (from.lat + to.lat) / 2
        const midLng = (from.lng + to.lng) / 2
        const windIcon = L.divIcon({
          html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer" onclick="">
            <div style="background:${isSelected?stormColor:'rgba(255,255,255,0.9)'};border:2px solid ${stormColor};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
              <svg width="20" height="20" viewBox="0 0 20 20">
                <line x1="10" y1="10" x2="${10+8*Math.sin((seg.wind_dir)*Math.PI/180)}" y2="${10-8*Math.cos((seg.wind_dir)*Math.PI/180)}" stroke="${isSelected?'#fff':stormColor}" stroke-width="2" stroke-linecap="round"/>
                <circle cx="10" cy="10" r="2" fill="${isSelected?'#fff':stormColor}"/>
              </svg>
            </div>
            <div style="background:${isSelected?stormColor:'rgba(255,255,255,0.9)'};color:${isSelected?'#fff':stormColor};font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.2)">${seg.wind_speed}km/h ${dirLabel(seg.wind_dir)}</div>
          </div>`,
          className: '', iconAnchor: [18, 18],
        })
        const windMarker = L.marker([midLat, midLng], { icon: windIcon })
          .addTo(map)
          .on('click', () => setSelectedIdx(idx))
        overlaysRef.current.push(windMarker)
      })

      // Zoom to fit
      if (mainPts.length > 0) {
        const bounds = L.latLngBounds(mainPts.map(p => [p.lat, p.lng] as [number,number]))
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    })
  }, [segments, selectedIdx, coursePoints])

  async function selectRace(race: Race) {
    setSelectedRace(race)
    setNoCourse(false)
    setLoading(true)
    await ensureMap()
    try {
      const pb = getPocketBase()

      if (!race.course_id) {
        setNoCourse(true)
        setSegments([])
        setCoursePoints([])
        setLoading(false)
        return
      }

      const course = await pb.collection('courses').getOne(race.course_id)
      const points: CoursePoint[] = typeof course.points === 'string' ? JSON.parse(course.points || '[]') : (course.points || [])
      setCoursePoints(points)
      const mainPts = points
        .filter(p => p.type === 'start' || p.type === 'waypoint' || p.type === 'checkpoint' || p.type === 'finish')
        .sort((a: any, b: any) => a.order - b.order)

      // Meglévő szegmensek
      const existing = await pb.collection('weather_segments').getFullList({
        filter: `race_id="${race.id}"`, sort: 'from_cp_index',
      })

      if (existing.length > 0) {
        setSegments(existing.map((s: any) => ({
          id: s.id, race_id: s.race_id,
          from_cp_index: s.from_cp_index, to_cp_index: s.to_cp_index,
          name: s.name || `${mainPts[s.from_cp_index]?.name} → ${mainPts[s.to_cp_index]?.name}`,
          wind_dir: s.wind_dir, wind_speed: s.wind_speed, storm_level: s.storm_level || 0,
        })))
      } else {
        // Generálás pályából — CSAK mainPts alapján, fix darabszám
        const newSegs: WeatherSegment[] = []
        for (let i = 0; i < mainPts.length - 1; i++) {
          newSegs.push({
            race_id: race.id, from_cp_index: i, to_cp_index: i+1,
            name: `${mainPts[i].name} → ${mainPts[i+1].name}`,
            wind_dir: 225, wind_speed: 18, storm_level: 0,
          })
        }
        setSegments(newSegs)
        flash('Szegmensek generálva — mentsd el!')
      }
      setSelectedIdx(0)
    } catch (e) { flash('⚠ Hiba') }
    setLoading(false)
  }

  function updateSeg(field: keyof WeatherSegment, value: any) {
    setSegments(prev => prev.map((s, i) => i === selectedIdx ? { ...s, [field]: value } : s))
  }

  async function saveSegments() {
    if (!selectedRace) return
    setSaving(true)
    try {
      const pb = getPocketBase()
      const updated = [...segments]
      for (let i = 0; i < updated.length; i++) {
        const seg = updated[i]
        const data = { wind_dir: Number(seg.wind_dir), wind_speed: Number(seg.wind_speed), storm_level: Number(seg.storm_level || 0), name: seg.name || '', race_id: seg.race_id, from_cp_index: Number(seg.from_cp_index ?? i), to_cp_index: Number(seg.to_cp_index ?? i+1) }
        if (seg.id) {
          await pb.collection('weather_segments').update(seg.id, data)
        } else {
          const created = await pb.collection('weather_segments').create(data)
          updated[i] = { ...seg, id: created.id }
        }
      }
      setSegments(updated)
      flash('✓ Mentve')
    } catch (e) { flash('⚠ Hiba') }
    setSaving(false)
  }

  const seg = segments[selectedIdx]

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Fejléc */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0 flex-wrap">
        <Wind className="size-5 text-muted-foreground" strokeWidth={1.75}/>
        <h1 className="font-heading text-lg font-bold text-foreground">Időjárás</h1>
        <div className="flex gap-2 flex-wrap">
          {races.map(race => (
            <button key={race.id} onClick={() => selectRace(race)}
              className={cn('rounded-sm border px-3 py-1.5 font-heading text-xs font-semibold transition-all',
                selectedRace?.id === race.id
                  ? 'border-secondary bg-secondary/15 text-secondary'
                  : 'border-border text-muted-foreground hover:border-secondary/40')}>
              {race.name}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {msg && <span className="label-caps text-[10px] text-secondary bg-secondary/10 px-2 py-1 rounded-sm">{msg}</span>}
          {segments.length > 0 && (
            <button onClick={saveSegments} disabled={saving}
              className="flex items-center gap-2 rounded-sm bg-foreground px-3 py-1.5 font-heading text-sm font-semibold text-background hover:bg-secondary disabled:opacity-50">
              <Save className="size-4"/>{saving ? 'Mentés...' : 'Mentés'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", height: "600px" }}>
        {/* Térkép */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }}/>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <RefreshCw className="size-6 animate-spin text-muted-foreground"/>
            </div>
          )}
          {!selectedRace && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-10">
              <p className="font-heading text-sm text-muted-foreground">Válassz versenyt a fejlécben</p>
            </div>
          )}
          {noCourse && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-10">
              <div className="text-center">
                <AlertTriangle className="size-8 text-accent mx-auto mb-2"/>
                <p className="font-heading text-sm font-semibold text-foreground">Nincs pálya rendelve</p>
                <p className="text-xs text-muted-foreground mt-1">Rendeld hozzá a pályát a Versenyek menüpontban</p>
              </div>
            </div>
          )}
        </div>

        {/* Jobb panel — szegmens szerkesztő */}
        {seg && (
          <div style={{ width: "288px", flexShrink: 0, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--card)" }}>
            {/* Szegmens lista */}
            <div className="border-b border-border p-2">
              {segments.map((s, i) => (
                <button key={i} onClick={() => setSelectedIdx(i)}
                  className={cn('w-full text-left rounded-sm px-3 py-2 mb-0.5 transition-all',
                    i === selectedIdx ? 'bg-secondary/15 text-secondary' : 'text-muted-foreground hover:bg-muted')}>
                  <p className="font-heading text-xs font-semibold truncate">{s.name}</p>
                  <p className="text-[9px] label-caps">{s.wind_speed}km/h · {dirLabel(s.wind_dir)} · {['OK','⚠ 1.fok','🔴 2.fok'][s.storm_level]}</p>
                </button>
              ))}
            </div>

            {/* Szerkesztő */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="font-heading text-sm font-semibold text-foreground truncate">{seg.name}</p>

              {/* Szélirány */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="label-caps text-[9px] text-muted-foreground">Szélirány</label>
                  <span className="font-heading text-sm font-bold">{seg.wind_dir}° {dirLabel(seg.wind_dir)}</span>
                </div>
                <input type="range" min={0} max={359} value={seg.wind_dir}
                  onChange={e => updateSeg('wind_dir', Number(e.target.value))}
                  className="w-full h-3 rounded-sm cursor-pointer"
                  style={{ accentColor: 'var(--color-secondary)' }}/>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {[[0,'É'],[45,'ÉK'],[90,'K'],[135,'DK'],[180,'D'],[225,'DNy'],[270,'Ny'],[315,'ÉNy']].map(([deg, label]) => (
                    <button key={deg} onClick={() => updateSeg('wind_dir', deg)}
                      className={cn('rounded-sm border px-1.5 py-0.5 text-[9px] font-heading font-semibold',
                        seg.wind_dir === deg ? 'border-secondary bg-secondary/15 text-secondary' : 'border-border text-muted-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Szélsebesség */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="label-caps text-[9px] text-muted-foreground">Szélsebesség</label>
                  <span className="font-heading text-sm font-bold">{seg.wind_speed} km/h</span>
                </div>
                <input type="range" min={0} max={80} value={seg.wind_speed}
                  onChange={e => updateSeg('wind_speed', Number(e.target.value))}
                  className="w-full h-3 rounded-sm cursor-pointer"
                  style={{ accentColor: 'var(--color-secondary)' }}/>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {[[5,'Szélcsend'],[15,'Gyenge'],[25,'Közepes'],[40,'Erős'],[60,'Viharos']].map(([spd, label]) => (
                    <button key={spd} onClick={() => updateSeg('wind_speed', spd)}
                      className={cn('rounded-sm border px-1.5 py-0.5 text-[9px] font-heading font-semibold',
                        seg.wind_speed === spd ? 'border-secondary bg-secondary/15 text-secondary' : 'border-border text-muted-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Viharszint */}
              <div>
                <label className="label-caps text-[9px] text-muted-foreground block mb-2">Viharszint</label>
                <div className="flex gap-2">
                  {[{level:0,label:'Nincs',color:'border-border text-muted-foreground'},{level:1,label:'1. fokú',color:'border-accent text-accent'},{level:2,label:'2. fokú',color:'border-destructive text-destructive'}].map(({level,label,color}) => (
                    <button key={level} onClick={() => updateSeg('storm_level', level)}
                      className={cn('flex-1 rounded-sm border-2 py-2 font-heading text-xs font-semibold transition-all', color, seg.storm_level === level ? 'opacity-100' : 'opacity-35')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
