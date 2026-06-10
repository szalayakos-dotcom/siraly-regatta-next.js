'use client'

import { useEffect, useState, useRef } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { Plus, Trash2, Edit2, Save, X, MapPin, Flag, Anchor, Navigation } from 'lucide-react'
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

const POINT_TYPES = [
  { value: 'start',      label: 'Rajt',       color: '#c42b1c', icon: '🏁' },
  { value: 'checkpoint', label: 'Checkpoint',  color: '#2a6a7a', icon: '📍' },
  { value: 'waypoint',   label: 'Waypoint',   color: '#8a7a5a', icon: '⬟' },
  { value: 'finish',     label: 'Cél',        color: '#c8a030', icon: '🏆' },
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
          .bindTooltip(`${typeInfo.icon} ${pt.name}`, { permanent: false })
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
    if (!courseName.trim()) { flash('⚠ Adj nevet a pályának'); return }
    if (points.length < 2) { flash('⚠ Legalább 2 pont kell'); return }
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
        flash('✓ Pálya frissítve')
      } else {
        await pb.collection('courses').create(data)
        flash('✓ Pálya mentve')
      }
      closeEditor()
      load()
    } catch (e) { flash('⚠ Hiba: ' + (e as any)?.message) }
  }

  async function deleteCourse(id: string) {
    if (!confirm('Biztosan törlöd?')) return
    try {
      const pb = getPocketBase()
      await pb.collection('courses').delete(id)
      flash('✓ Törölve')
      load()
    } catch (e) { flash('⚠ Hiba') }
  }

  if (showEditor) return (
    <div className="flex flex-col h-full">
      {/* Szerkesztő fejléc */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
        <button onClick={closeEditor} className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-foreground">
          <X className="size-4"/>
        </button>
        <input value={courseName} onChange={e => setCourseName(e.target.value)}
          placeholder="Pálya neve..."
          className="flex-1 rounded-sm border border-border bg-background px-3 py-1.5 text-sm font-heading font-semibold outline-none focus:border-secondary"/>
        <span className="label-caps text-[9px] text-muted-foreground">
          {points.length} pont · {calcDistance(points)} km
        </span>
        {msg && <span className="label-caps text-[10px] text-secondary bg-secondary/10 px-2 py-1 rounded-sm">{msg}</span>}
        <button onClick={saveCourse}
          className="flex items-center gap-2 rounded-sm bg-secondary px-3 py-1.5 font-heading text-sm font-semibold text-secondary-foreground">
          <Save className="size-4"/>Mentés
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Bal panel */}
        <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
          {/* Pont típus választó */}
          <div className="p-3 border-b border-border">
            <p className="label-caps text-[9px] text-muted-foreground mb-2">Pont típusa (kattints a térképre)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {POINT_TYPES.map(({ value, label, icon }) => (
                <button key={value} onClick={() => setAddType(value as Point['type'])}
                  className={cn(
                    'rounded-sm border px-2 py-1.5 font-heading text-[10px] font-semibold text-left transition-all',
                    addType === value
                      ? 'border-secondary bg-secondary/15 text-secondary'
                      : 'border-border text-muted-foreground hover:border-secondary/40'
                  )}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Pont lista */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {points.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Kattints a térképre pontok hozzáadásához</p>
            ) : points.map((pt, i) => {
              const typeInfo = POINT_TYPES.find(t => t.value === pt.type)!
              return (
                <div key={i} className="flex items-center gap-2 rounded-sm border border-border bg-card p-2">
                  <span className="font-heading text-xs font-bold text-muted-foreground w-5 text-center">{i+1}</span>
                  <span style={{ color: typeInfo.color }} className="text-sm">{typeInfo.icon}</span>
                  <input value={pt.name} onChange={e => setPoints(prev => prev.map((p,j) => j===i ? {...p, name: e.target.value} : p))}
                    className="flex-1 min-w-0 text-xs bg-transparent outline-none text-foreground"/>
                  <div className="flex gap-0.5">
                    {i > 0 && (
                      <button onClick={() => movePoint(i, -1)} className="text-muted-foreground hover:text-foreground text-xs px-1">↑</button>
                    )}
                    {i < points.length-1 && (
                      <button onClick={() => movePoint(i, 1)} className="text-muted-foreground hover:text-foreground text-xs px-1">↓</button>
                    )}
                    <button onClick={() => removePoint(i)} className="text-muted-foreground hover:text-destructive px-1">
                      <X className="size-3"/>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Leírás */}
          <div className="p-3 border-t border-border">
            <textarea value={courseDesc} onChange={e => setCourseDesc(e.target.value)}
              placeholder="Pálya leírása..." rows={2}
              className="w-full text-xs rounded-sm border border-border bg-background px-2 py-1.5 outline-none focus:border-secondary resize-none"/>
          </div>
        </div>

        {/* Térkép */}
        <div ref={mapRef} className="flex-1 min-h-0"/>
      </div>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Pályák</h1>
          <p className="label-caps text-[9px] text-muted-foreground">{courses.length} pálya</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="label-caps text-[10px] text-secondary bg-secondary/10 px-2 py-1 rounded-sm">{msg}</span>}
          <button onClick={startNew}
            className="flex items-center gap-2 rounded-sm bg-foreground px-3 py-2 font-heading text-sm font-semibold text-background hover:bg-secondary transition-colors">
            <Plus className="size-4"/>Új pálya
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Betöltés...</p>
      ) : courses.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-8 text-center">
          <MapPin className="size-8 text-muted-foreground mx-auto mb-2"/>
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
              <div key={course.id} className="rounded-sm border border-border bg-card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-sm font-semibold text-foreground mb-1">{course.name}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {course.distance_km && <span><Navigation className="size-3 inline mr-1"/>{course.distance_km} km</span>}
                    {cpCount > 0 && <span><Flag className="size-3 inline mr-1"/>{cpCount} checkpoint</span>}
                    {wpCount > 0 && <span><Anchor className="size-3 inline mr-1"/>{wpCount} waypoint</span>}
                    {course.description && <span className="truncate max-w-xs">{course.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => startEdit(course)}
                    className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-foreground" title="Szerkesztés">
                    <Edit2 className="size-3.5"/>
                  </button>
                  <button onClick={() => deleteCourse(course.id)}
                    className="rounded-sm bg-muted p-1.5 text-muted-foreground hover:text-destructive" title="Törlés">
                    <Trash2 className="size-3.5"/>
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
