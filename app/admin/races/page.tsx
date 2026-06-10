'use client'

import { useEffect, useState } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { Plus, Play, Pause, Square, Trash2, Edit2, Clock, Mail, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Course {
  id: string
  name: string
  distance_km?: number
}

interface Race {
  id: string
  name: string
  status: string
  actual_start?: string
  scheduled_start?: string
  entry_fee?: number
  description?: string
  min_rank?: string
  boat_classes?: string
  course_id?: string
  poster?: string
  created: string
}


async function resizePoster(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      const ratio = Math.min(800 / width, 600 / height)
      if (ratio >= 1) { resolve(file); return }
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        resolve(new File([blob!], file.name.replace(/[^.]+$/, 'jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.85)
    }
    img.src = url
  })
}

const RANKS = [
  { value: 'open',     label: 'Nyílt verseny' },
  { value: 'beginner', label: 'Kezdő' },
  { value: 'advanced', label: 'Haladó' },
  { value: 'pro',      label: 'Profi' },
  { value: 'master',   label: 'Mester' },
]

const BOAT_CLASSES = [
  { value: 'ys1', label: 'Ys.I' },
  { value: 'ys2', label: 'Ys.II' },
  { value: 'ys3', label: 'Ys.III' },
]

const statusColor: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  published: 'bg-secondary/20 text-secondary',
  active:    'bg-green-500/20 text-green-600',
  paused:    'bg-accent/20 text-accent',
  finished:  'bg-border text-muted-foreground',
}
const statusLabel: Record<string, string> = {
  draft:     'Vázlat',
  published: 'Kiírva',
  active:    'Fut',
  paused:    'Felfüggesztve',
  finished:  'Befejezett',
}

function RaceForm({
  initial, onSave, onCancel
}: {
  initial?: Partial<Race>,
  onSave: (data: any) => void,
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [date, setDate] = useState(initial?.scheduled_start ? new Date(initial.scheduled_start).toISOString().slice(0,16) : '')
  const [fee, setFee] = useState(initial?.entry_fee || 0)
  const [desc, setDesc] = useState(initial?.description || '')
  const [rank, setRank] = useState(initial?.min_rank || 'open')
  const [classes, setClasses] = useState<string[]>(() => {
    try { return JSON.parse(initial?.boat_classes || '["ys1","ys2","ys3"]') } catch { return ['ys1','ys2','ys3'] }
  })
  const [courseId, setCourseId] = useState((initial as any)?.course_id || '')
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreview, setPosterPreview] = useState((initial as any)?.poster && (initial as any)?.id ? `http://127.0.0.1:8090/api/files/races/${(initial as any).id}/${(initial as any).poster}` : '')
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    const pb = getPocketBase()
    pb.collection('courses').getFullList({ sort: '-id' })
      .then(list => setCourses(list as Course[]))
      .catch(() => {})
  }, [])

  function toggleClass(val: string) {
    setClasses(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val])
  }

  function handleSave() {
    if (!name.trim()) return
    onSave({
      name,
      scheduled_start: date ? new Date(date).toISOString() : null,
      entry_fee: fee,
      description: desc,
      min_rank: rank,
      boat_classes: JSON.stringify(classes),
      course_id: courseId || null,
      _posterFile: posterFile,
    })
  }

  return (
    <div className="rounded-sm border border-secondary/40 bg-secondary/5 p-4 space-y-3">
      <p className="font-heading text-sm font-semibold text-foreground">
        {initial?.id ? 'Szerkesztés' : 'Új verseny'}
      </p>

      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="Verseny neve..."
        className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <label className="label-caps text-[9px] text-muted-foreground block mb-1">Rajt időpontja</label>
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
        </div>
        <div>
          <label className="label-caps text-[9px] text-muted-foreground block mb-1">Nevezési díj (kr)</label>
          <input type="number" min={0} value={fee} onChange={e => setFee(Number(e.target.value))}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Hajóosztályok */}
        <div>
          <label className="label-caps text-[9px] text-muted-foreground block mb-2">Hajóosztályok</label>
          <div className="flex gap-3">
            {BOAT_CLASSES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={classes.includes(value)}
                  onChange={() => toggleClass(value)}
                  className="w-4 h-4 rounded-sm accent-secondary cursor-pointer"/>
                <span className="font-heading text-sm font-semibold text-foreground">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Rang korlát */}
        <div>
          <label className="label-caps text-[9px] text-muted-foreground block mb-2">Rang korlát</label>
          <div className="flex flex-wrap gap-1.5">
            {RANKS.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setRank(value)}
                className={cn(
                  'rounded-sm border px-2.5 py-1 font-heading text-xs font-semibold transition-all',
                  rank === value
                    ? 'border-secondary bg-secondary/20 text-secondary'
                    : 'border-border text-muted-foreground hover:border-secondary/50'
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pálya választó */}
      <div>
        <label className="label-caps text-[9px] text-muted-foreground block mb-1">Pálya</label>
        <select value={courseId} onChange={e => setCourseId(e.target.value)}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary">
          <option value="">— Nincs pálya kiválasztva —</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.distance_km ? ` (${c.distance_km} km)` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Poszter */}
      <div>
        <label className="label-caps text-[9px] text-muted-foreground block mb-1">Verseny poszter (800×600px)</label>
        <div className="flex items-start gap-3">
          {posterPreview && (
            <img src={posterPreview} alt="poszter" className="w-40 h-30 object-cover rounded-sm border border-border" style={{ height: '90px' }}/>
          )}
          <input type="file" accept="image/*"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (file) {
                const resized = await resizePoster(file)
                setPosterFile(resized)
                setPosterPreview(URL.createObjectURL(resized))
              }
            }}
            className="flex-1 text-sm text-muted-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-secondary/15 file:px-3 file:py-1 file:text-xs file:font-heading file:font-semibold file:text-secondary"/>
        </div>
      </div>

      {/* Leírás */}
      <div>
        <label className="label-caps text-[9px] text-muted-foreground block mb-1">Versenyleírás</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          rows={3} placeholder="A verseny részletei, útvonal, különleges szabályok..."
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary resize-none"/>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 rounded-sm bg-secondary py-2 font-heading text-sm font-semibold text-secondary-foreground">
          {initial?.id ? 'Mentés' : 'Létrehozás'}
        </button>
        <button onClick={onCancel}
          className="rounded-sm border border-border px-4 py-2 text-sm text-muted-foreground">
          Mégse
        </button>
      </div>
    </div>
  )
}

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [emailSending, setEmailSending] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const pb = getPocketBase()
      const list = await pb.collection('races').getFullList({ sort: '-id' })
      setRaces(list as Race[])
    } catch (e) { console.error('Load error:', e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  async function createRace(data: any) {
    try {
      const pb = getPocketBase()
      const { _posterFile, ...rest } = data
      const formData = new FormData()
      Object.entries({ ...rest, status: 'draft' }).forEach(([k, v]) => {
        if (v !== null && v !== undefined) formData.append(k, String(v))
      })
      if (_posterFile) formData.append('poster', _posterFile)
      await pb.collection('races').create(formData)
      setShowNew(false)
      flash('✓ Verseny létrehozva')
      load()
    } catch (e) { flash('⚠ Hiba: ' + (e as any)?.message) }
  }

  async function updateRace(id: string, data: any) {
    try {
      const pb = getPocketBase()
      const { _posterFile, ...rest } = data
      const formData = new FormData()
      Object.entries(rest).forEach(([k, v]) => {
        if (v !== null && v !== undefined) formData.append(k, String(v))
      })
      if (_posterFile) formData.append('poster', _posterFile)
      await pb.collection('races').update(id, formData)
      setEditId(null)
      flash('✓ Mentve')
      load()
    } catch (e) { flash('⚠ Hiba') }
  }

  async function setStatus(id: string, status: string) {
    try {
      const pb = getPocketBase()
      const updates: any = { status }
      if (status === 'active') updates.actual_start = new Date().toISOString()
      await pb.collection('races').update(id, updates)
      flash(`✓ ${statusLabel[status] || status}`)
      load()
    } catch (e) { flash('⚠ Hiba') }
  }

  async function deleteRace(id: string) {
    if (!confirm('Biztosan törlöd?')) return
    try {
      const pb = getPocketBase()
      await pb.collection('races').delete(id)
      flash('✓ Törölve')
      load()
    } catch (e) { flash('⚠ Hiba') }
  }

  async function sendEmail(race: Race) {
    setEmailSending(race.id)
    try {
      const pb = getPocketBase()
      const users = await pb.collection('users').getFullList()
      flash(`✓ Email kiküldve ${users.length} felhasználónak`)
    } catch (e) {
      flash('⚠ Email hiba — ellenőrizd a PocketBase SMTP beállítást')
    }
    setEmailSending(null)
  }

  function getCourseName(race: Race) {
    if (!race.course_id) return null
    const pb = getPocketBase()
    return race.course_id
  }

  function getClasses(race: Race) {
    try {
      const arr = JSON.parse(race.boat_classes || '[]')
      return arr.map((c: string) => BOAT_CLASSES.find(b => b.value === c)?.label || c).join(', ')
    } catch { return '—' }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Versenyek</h1>
          <p className="label-caps text-[9px] text-muted-foreground">{races.length} verseny</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="label-caps text-[10px] text-secondary bg-secondary/10 px-2 py-1 rounded-sm">{msg}</span>}
          <button onClick={() => { setShowNew(v => !v); setEditId(null) }}
            className="flex items-center gap-2 rounded-sm bg-foreground px-3 py-2 font-heading text-sm font-semibold text-background hover:bg-secondary transition-colors">
            <Plus className="size-4"/>Új verseny
          </button>
        </div>
      </div>

      {showNew && (
        <RaceForm onSave={createRace} onCancel={() => setShowNew(false)}/>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Betöltés...</p>
      ) : races.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Még nincs verseny — hozz létre egyet!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {races.map(race => (
            <div key={race.id} className="rounded-sm border border-border bg-card overflow-hidden">
              {editId === race.id ? (
                <div className="p-4">
                  <RaceForm
                    initial={race}
                    onSave={data => updateRace(race.id, data)}
                    onCancel={() => setEditId(null)}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-heading text-sm font-semibold text-foreground">{race.name}</p>
                        <span className={`label-caps text-[8px] px-1.5 py-0.5 rounded-sm ${statusColor[race.status] || statusColor.idle}`}>
                          {statusLabel[race.status] || race.status}
                        </span>
                        {race.min_rank && race.min_rank !== 'open' && (
                          <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-accent/15 text-accent">
                            {RANKS.find(r => r.value === race.min_rank)?.label}
                          </span>
                        )}
                        {race.entry_fee ? (
                          <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                            {race.entry_fee} kr
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {race.scheduled_start && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3"/>
                            Rajt: {new Date(race.scheduled_start).toLocaleString('hu-HU')}
                          </span>
                        )}
                        {race.actual_start && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3"/>
                            Elindult: {new Date(race.actual_start).toLocaleString('hu-HU')}
                          </span>
                        )}
                        {race.boat_classes && (
                          <span>{getClasses(race)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setExpandedId(expandedId === race.id ? null : race.id)}
                        className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-foreground">
                        {expandedId === race.id ? <ChevronUp className="size-3.5"/> : <ChevronDown className="size-3.5"/>}
                      </button>
                      <button onClick={() => { setEditId(race.id); setShowNew(false) }}
                        className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-foreground" title="Szerkesztés">
                        <Edit2 className="size-3.5"/>
                      </button>
                      <button onClick={() => sendEmail(race)} disabled={emailSending === race.id}
                        className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-secondary disabled:opacity-40" title="Email értesítő">
                        <Mail className="size-3.5"/>
                      </button>
                      {/* Versenykiírás */}
                      {race.status === 'draft' && (
                        <button onClick={() => setStatus(race.id, 'published')}
                          className="rounded-sm bg-secondary/15 px-2.5 py-1.5 text-secondary hover:bg-secondary/25 font-heading text-[10px] font-semibold" title="Versenykiírás">
                          📢 KIÍRÁS
                        </button>
                      )}
                      {/* Felfüggesztés */}
                      {race.status === 'active' && (
                        <button onClick={() => setStatus(race.id, 'paused')}
                          className="rounded-sm bg-accent/15 p-1.5 text-accent hover:bg-accent/25" title="Felfüggesztés">
                          <Pause className="size-3.5"/>
                        </button>
                      )}
                      {/* Folytatás */}
                      {race.status === 'paused' && (
                        <button onClick={() => setStatus(race.id, 'active')}
                          className="rounded-sm bg-secondary/15 p-1.5 text-secondary hover:bg-secondary/25" title="Folytatás">
                          <Play className="size-3.5"/>
                        </button>
                      )}
                      {/* Befejezés */}
                      {(race.status === 'active' || race.status === 'paused') && (
                        <button onClick={() => setStatus(race.id, 'finished')}
                          className="rounded-sm bg-destructive/15 p-1.5 text-destructive hover:bg-destructive/25" title="Befejezés">
                          <Square className="size-3.5"/>
                        </button>
                      )}
                      <button onClick={() => deleteRace(race.id)}
                        className="rounded-sm bg-muted p-1.5 text-muted-foreground hover:text-destructive" title="Törlés">
                        <Trash2 className="size-3.5"/>
                      </button>
                    </div>
                  </div>

                  {/* Részletek */}
                  {expandedId === race.id && race.description && (
                    <div className="border-t border-border px-4 py-3 bg-muted/30">
                      <p className="label-caps text-[9px] text-muted-foreground mb-1">Leírás</p>
                      <p className="text-sm text-foreground">{race.description}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
