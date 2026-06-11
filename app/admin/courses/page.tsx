'use client'

import { useEffect, useState, useRef } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import {
  Plus, Trash2, Edit2, Save, X, MapPin, Flag, Anchor, Navigation,
  ChevronUp, ChevronDown, CircleDot, Trophy, Diamond, Route,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Point {
  type: 'start' | 'checkpoint' | 'waypoint' | 'finish'
  lat: number
  lng: number
  name: string
  order: number
}

interface Course {
  id: string
  name: string
  description?: string
  points?: string
  distance_km?: number
}

const POINT_TYPES: {
  value: Point['type']
  label: string
  color: string
  Icon: typeof Flag
}[] = [
  { value: 'start',      label: 'Rajt',       color: '#c42b1c', Icon: Flag },
  { value: 'checkpoint', label: 'Checkpoint', color: '#2a6a7a', Icon: CircleDot },
  { value: 'waypoint',   label: 'Waypoint',   color: '#8a7a5a', Icon: Diamond },
  { value: 'finish',     label: 'Cél',        color: '#c8a030', Icon: Trophy },
]

function calcDistance(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const R = 6371
    const dLat = (points[i].lat - points[i-1].lat) * Math.PI / 180
    const dLng = (points[i].lng - points[i-1].lng) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(points[i-1].lat*Math.PI/180) * Math.cos(points[i].lat*Math.PI/180) * Math.sin(dLng/2)**2
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }
  return Math.round(total * 10) / 10
}

export default function CoursesPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const polylinesRef = useRef<any[]>([])

  const [courses, setCourses] = useState<Course[]>([])
  const [editing, setEditing] = useState<Course | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [courseName, setCourseName] = useState('')
  const [courseDesc, setCourseDesc] = useState('')
  const [addType, setAddType] = useState<Point['type']>('checkpoint')
  const addTypeRef = useRef<Point['type']>('checkpoint')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)

  useEffect(() => { addTypeRef.current = addType }, [addType])

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  async function load() {
    setLoading(true)
    try {
      const pb = getPocketBase()
      const list = await pb.collection('courses').getFullList({ sort: '-id' })
      setCourses(list as Course[])
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Térkép init
  useEffect(() => {
    if (!showEditor || !mapRef.current || mapInstanceRef.current) return

    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      const map = L.map(mapRef.current!, {
        center: [46.88, 17.78], zoom: 11,
        zoomControl: true, attributionControl: false,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { opacity: 0.85 }).addTo(map)
      mapInstanceRef.current = map

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng
        setPoints(prev => {
          const order = prev.length
          const currentType = addTypeRef.current
          const newPoint: Point = {
            type: currentType,
            lat: Math.round(lat * 100000) / 100000,
            lng: Math.round(lng * 100000) / 100000,
            name: currentType === 'start' ? 'Rajt' : currentType === 'finish' ? 'Cél' : currentType === 'waypoint' ? `Wp ${order}` : `CP ${order}`,
            order,
          }
          return [...prev, newPoint]
        })
      })
    }
    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [showEditor])

  // Térkép frissítése pontok alapján
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    import('leaflet').then(({ default: L }) => {
      // Régi markerek törlése
      markersRef.current.forEach(m => m.remove())
      polylinesRef.current.forEach(p => p.remove())
      markersRef.current = []
      polylinesRef.current = []

      if (points.length === 0) return

      // Új markerek
      points.forEach((pt, i) => {
        const typeInfo = POINT_TYPES.find(t => t.value === pt.type)!
        const icon = L.divIcon({
          html: `<div style="background:${typeInfo.color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-weight:700">${i+1}</div>`,
          className: '', iconAnchor: [14,14],
        })
        const marker = L.marker([pt.lat, pt.lng], { icon })
          .addTo(map)
          .bindTooltip(`${typeInfo.label} · ${pt.name}`, { permanent: false })
        markersRef.current.push(marker)
      })

      // Útvonal vonalak
      if (points.length > 1) {
        // Checkpoint és finish vonalak (piros)
        const mainLine = L.polyline(
          points.filter(p => p.type !== 'waypoint').map(p => [p.lat, p.lng] as [number,number]),
          { color: '#c42b1c', weight: 2, opacity: 0.7, dashArray: '6 4' }
        ).addTo(map)
        polylinesRef.current.push(mainLine)

        // Waypoint vonalak (szürke)
        for (let i = 1; i < points.length; i++) {
          if (points[i].type === 'waypoint' || points[i-1].type === 'waypoint') {
            const wpLine = L.polyline(
              [[points[i-1].lat, points[i-1].lng], [points[i].lat, points[i].lng]],
              { color: '#8a7a5a', weight: 1.5, opacity: 0.5, dashArray: '3 4' }
            ).addTo(map)
            polylinesRef.current.push(wpLine)
          }
        }
      }
    })
  }, [points])

  function removePoint(idx: number) {
    setPoints(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order: i })))
  }

  function movePoint(idx: number, dir: -1 | 1) {
    setPoints(prev => {
      const next = [...prev]
      const tmp = next[idx]
      next[idx] = next[idx + dir]
      next[idx + dir] = tmp
      return next.map((p, i) => ({ ...p, order: i }))
    })
  }

  function startNew() {
    setEditing(null)
    setPoints([])
    setCourseName('')
    setCourseDesc('')
    setShowEditor(true)
  }

  function startEdit(course: Course) {
    setEditing(course)
    setCourseName(course.name)
    setCourseDesc(course.description || '')
    try {
      setPoints(JSON.parse(course.points || '[]'))
    } catch { setPoints([]) }
    setShowEditor(true)
  }

  function closeEditor() {
    setShowEditor(false)
    setEditing(null)
    setPoints([])
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }
  }

  async function saveCourse() {
    if (!courseName.trim()) { flash('Adj nevet a pályának'); return }
    if (points.length < 2) { flash('Legalább 2 pont kell'); return }
    try {
      const pb = getPocketBase()
      const data = {
        name: courseName,
        description: courseDesc,
        points: JSON.stringify(points),
        distance_km: calcDistance(points),
      }
      if (editing) {
        await pb.collection('courses').update(editing.id, data)
        flash('Pálya frissítve')
      } else {
        await pb.collection('courses').create(data)
        flash('Pálya mentve')
      }
      closeEditor()
      load()
    } catch (e) { flash('Hiba: ' + (e as any)?.message) }
  }

  async function deleteCourse(id: string) {
    if (!confirm('Biztosan törlöd?')) return
    try {
      const pb = getPocketBase()
      await pb.collection('courses').delete(id)
      flash('Törölve')
      load()
    } catch (e) { flash('Hiba') }
  }

  // ---- SZERKESZTŐ NÉZET ----
  if (showEditor) return (
    <div className="flex h-full flex-col bg-background">
      {/* Szerkesztő fejléc — réz műszerléc */}
      <div className="instrument-bezel relative flex shrink-0 items-center gap-3 px-4 py-3">
        <span className="rivet left-2 top-2" />
        <span className="rivet right-2 top-2" />
        <span className="rivet bottom-2 left-2" />
        <span className="rivet bottom-2 right-2" />
        <button onClick={closeEditor}
          className="rounded-sm border border-border/60 bg-background/40 p-1.5 text-muted-foreground transition-colors hover:text-foreground">
          <X className="size-4" />
        </button>
        <input value={courseName} onChange={e => setCourseName(e.target.value)}
          placeholder="Pálya neve..."
          className="flex-1 rounded-sm border border-border/60 bg-background/60 px-3 py-1.5 font-heading text-sm font-semibold text-foreground outline-none focus:border-secondary" />
        <span className="label-caps hidden text-[9px] text-muted-foreground sm:inline">
          {points.length} pont · {calcDistance(points)} km
        </span>
        {msg && <span className="brass-plate label-caps rounded-sm px-2 py-1 text-[10px]">{msg}</span>}
        <button onClick={saveCourse}
          className="flex items-center gap-2 rounded-sm bg-secondary px-3 py-1.5 font-heading text-sm font-semibold text-secondary-foreground transition-colors hover:brightness-110">
          <Save className="size-4" />Mentés
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Bal panel */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
          {/* Pont típus választó */}
          <div className="border-b border-border p-3">
            <p className="label-caps mb-2 text-[9px] text-muted-foreground">Pont típusa (kattints a térképre)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {POINT_TYPES.map(({ value, label, Icon, color }) => (
                <button key={value} onClick={() => setAddType(value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-sm border px-2 py-1.5 font-heading text-[10px] font-semibold transition-all',
                    addType === value
                      ? 'border-secondary bg-secondary/15 text-secondary'
                      : 'border-border text-muted-foreground hover:border-secondary/40'
                  )}>
                  <Icon className="size-3.5 shrink-0" style={{ color: addType === value ? undefined : color }} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Pont lista */}
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {points.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Kattints a térképre pontok hozzáadásához</p>
            ) : points.map((pt, i) => {
              const typeInfo = POINT_TYPES.find(t => t.value === pt.type)!
              const PtIcon = typeInfo.Icon
              return (
                <div key={i} className="flex items-center gap-2 rounded-sm border border-border bg-background/50 p-2">
                  <span className="w-5 text-center font-heading text-xs font-bold text-muted-foreground">{i+1}</span>
                  <PtIcon className="size-3.5 shrink-0" style={{ color: typeInfo.color }} />
                  <input value={pt.name} onChange={e => setPoints(prev => prev.map((p,j) => j===i ? {...p, name: e.target.value} : p))}
                    className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none" />
                  <div className="flex gap-0.5">
                    {i > 0 && (
                      <button onClick={() => movePoint(i, -1)} className="px-0.5 text-muted-foreground hover:text-foreground"><ChevronUp className="size-3.5" /></button>
                    )}
                    {i < points.length-1 && (
                      <button onClick={() => movePoint(i, 1)} className="px-0.5 text-muted-foreground hover:text-foreground"><ChevronDown className="size-3.5" /></button>
                    )}
                    <button onClick={() => removePoint(i)} className="px-0.5 text-muted-foreground hover:text-destructive">
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Leírás */}
          <div className="border-t border-border p-3">
            <textarea value={courseDesc} onChange={e => setCourseDesc(e.target.value)}
              placeholder="Pálya leírása..." rows={2}
              className="w-full resize-none rounded-sm border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-secondary" />
          </div>
        </div>

        {/* Térkép */}
        <div ref={mapRef} className="min-h-0 flex-1" />
      </div>
    </div>
  )

  // ---- LISTA NÉZET ----
  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Fejléc — réz műszerléc */}
      <div className="instrument-bezel relative flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className="rivet left-2 top-2" />
        <span className="rivet right-2 top-2" />
        <span className="rivet bottom-2 left-2" />
        <span className="rivet bottom-2 right-2" />
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-sm border border-border/50 bg-background/40 text-secondary">
            <Route className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold text-foreground">Pályák</h1>
            <p className="label-caps text-[9px] text-muted-foreground">COURSE-REG · {courses.length} pálya</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="brass-plate label-caps rounded-sm px-2 py-1 text-[10px]">{msg}</span>}
          <button onClick={startNew}
            className="flex items-center gap-2 rounded-sm bg-secondary px-3 py-2 font-heading text-sm font-semibold text-secondary-foreground transition-colors hover:brightness-110">
            <Plus className="size-4" />Új pálya
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Betöltés...</p>
      ) : courses.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-8 text-center">
          <MapPin className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Még nincs pálya — hozz létre egyet!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {courses.map(course => {
            let pts: Point[] = []
            try { pts = JSON.parse(course.points || '[]') } catch {}
            const cpCount = pts.filter(p => p.type === 'checkpoint').length
            const wpCount = pts.filter(p => p.type === 'waypoint').length
            return (
              <div key={course.id} className="flex items-center gap-3 rounded-sm border border-border bg-card p-4 transition-colors hover:border-secondary/40">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-border/60 bg-background/50 text-secondary">
                  <MapPin className="size-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 font-heading text-sm font-semibold text-foreground">{course.name}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {course.distance_km ? <span className="inline-flex items-center gap-1"><Navigation className="size-3" />{course.distance_km} km</span> : null}
                    {cpCount > 0 && <span className="inline-flex items-center gap-1"><Flag className="size-3" />{cpCount} checkpoint</span>}
                    {wpCount > 0 && <span className="inline-flex items-center gap-1"><Anchor className="size-3" />{wpCount} waypoint</span>}
                    {course.description && <span className="max-w-xs truncate">{course.description}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => startEdit(course)}
                    className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-foreground" title="Szerkesztés">
                    <Edit2 className="size-3.5" />
                  </button>
                  <button onClick={() => deleteCourse(course.id)}
                    className="rounded-sm bg-muted p-1.5 text-muted-foreground hover:text-destructive" title="Törlés">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
