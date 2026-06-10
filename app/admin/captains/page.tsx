'use client'

import { useEffect, useState } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { Plus, Trash2, Edit2, Anchor, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Captain {
  id: string
  name: string
  description?: string
  image?: string
  collectionId?: string
  sail_rating: number
  weather_rating: number
  helm_rating: number
  rental_credits: number
  allowed_classes?: string
  available: boolean
  gadget?: string
}


const GADGETS = [
  { value: '',              label: '— Nincs gadget —',              emoji: '' },
  { value: 'tech_guru',     label: 'Tech guru',                     emoji: '🤖', desc: 'Autopilot ingyen megvásárolva' },
  { value: 'alkudozo',      label: 'Alkudozó',                      emoji: '💰', desc: 'Nevezési díj -40%' },
  { value: 'rajtmester',    label: 'Rajtmester',                    emoji: '⏱', desc: 'Induláskor +30mp előny' },
  { value: 'viharlovas',    label: 'Viharlovas',                    emoji: '🛡', desc: 'Viharban nincs sebesség csökkentés' },
  { value: 'szelLovas',     label: 'Széllovas',                     emoji: '💨', desc: 'Hátszélben +15% sebesség' },
  { value: 'kotelmagus',    label: 'Kötélmágus',                    emoji: '🪢', desc: 'Vitorlacsere penalty 0 perc' },
  { value: 'spinn_mester',  label: 'Spinnaker mester',              emoji: '⛵', desc: 'Spinnaker trim automatikusan 100%' },
  { value: 'driftvadasz',   label: 'Driftvadász',                   emoji: '🌊', desc: 'Drift 50%-kal csökkentve' },
  { value: 'szerelo',       label: 'Szerelő',                       emoji: '🔧', desc: '1x Davy Jones vagy vitorlacsere penalty törlés' },
  { value: 'bajnok',        label: 'Bajnok',                        emoji: '🏆', desc: 'Pontszorzó x1.5 ha top 3' },
  { value: 'trim_mester',   label: 'Trim-mester',                   emoji: '⭐', desc: 'Optimális trim gomb ingyen' },
  { value: 'hajnali_madar', label: 'Hajnali madár',                 emoji: '🌅', desc: 'Versenyidő -5%' },
  { value: 'kem',           label: 'Kém',                           emoji: '👁', desc: 'Látja mások vitorlabeállítását' },
  { value: 'algamester',    label: 'Algamester',                    emoji: '🌿', desc: '+10% sebesség sekély/parti szakaszon' },
  { value: 'custom',        label: 'Egyéni gadget',                 emoji: '➕', desc: 'Bővíthető — később meghatározható' },
]

const RANKS = [
  { value: 'beginner', label: 'Kezdő',  color: 'bg-muted text-muted-foreground' },
  { value: 'advanced', label: 'Haladó', color: 'bg-secondary/15 text-secondary' },
  { value: 'pro',      label: 'Profi',  color: 'bg-accent/15 text-accent' },
  { value: 'master',   label: 'Mester', color: 'bg-destructive/15 text-destructive' },
]

async function resizeImage(file: File, maxW = 400, maxH = 400, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width <= maxW && height <= maxH) { resolve(file); return }
      const ratio = Math.min(maxW / width, maxH / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        resolve(new File([blob!], file.name.replace(/[^.]+$/, 'jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.src = url
  })
}

function SkillBar({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="label-caps text-[9px] text-muted-foreground">{label}</label>
        <span className="font-heading text-sm font-bold text-foreground">{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-sm cursor-pointer"
        style={{ accentColor: 'var(--color-secondary)' }}/>
    </div>
  )
}

function CaptainForm({ initial, onSave, onCancel }: {
  initial?: Partial<Captain>, onSave: (data: any) => void, onCancel: () => void
}) {
  const [name, setName]           = useState(initial?.name || '')
  const [bio, setBio]             = useState(initial?.description || '')
  const [hireCost, setHireCost]   = useState(initial?.rental_credits || 50)
  const [available, setAvailable] = useState(initial?.available ?? true)
  const [skillTrim, setSkillTrim]   = useState(initial?.sail_rating || 50)
  const [skillTactic, setSkillTactic] = useState(initial?.weather_rating || 50)
  const [skillNav, setSkillNav]   = useState(initial?.helm_rating || 50)
  const [gadget, setGadget]       = useState(initial?.gadget || '')
  const [imgFile, setImgFile]     = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState(
    initial?.image && initial?.id
      ? `http://127.0.0.1:8090/api/files/captains/${initial.id}/${initial.image}`
      : ''
  )

  const avgSkill = Math.round((skillTrim + skillTactic + skillNav) / 3)

  return (
    <div className="rounded-sm border border-secondary/40 bg-secondary/5 p-4 space-y-4">
      <p className="font-heading text-sm font-semibold">{initial?.id ? 'Szerkesztés' : 'Új kapitány'}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bal: alap adatok */}
        <div className="space-y-3">
          <div>
            <label className="label-caps text-[9px] text-muted-foreground block mb-1">Név *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="Kovács János kapitány..."
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
          </div>

          <div>
            <label className="label-caps text-[9px] text-muted-foreground block mb-1">Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
              placeholder="Tapasztalt balatoni vitorlázó..."
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary resize-none"/>
          </div>

          {/* Bérleti díj + elérhetőség */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label-caps text-[9px] text-muted-foreground block mb-1">Bérleti díj (kr/verseny)</label>
              <input type="number" min={0} value={hireCost} onChange={e => setHireCost(Number(e.target.value))}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
            </div>
            <div className="flex flex-col justify-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)}
                  className="w-4 h-4 rounded-sm accent-secondary"/>
                <span className="label-caps text-[9px] text-muted-foreground">Elérhető</span>
              </label>
            </div>
          </div>

          {/* Gadget választó */}
          <div>
            <label className="label-caps text-[9px] text-muted-foreground block mb-2">Különleges képesség (gadget)</label>
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {GADGETS.map(g => (
                <button key={g.value} type="button" onClick={() => setGadget(g.value)}
                  className={cn(
                    'rounded-sm border px-3 py-2 text-left transition-all',
                    gadget === g.value
                      ? 'border-secondary bg-secondary/15'
                      : 'border-border hover:border-secondary/40'
                  )}>
                  <div className="flex items-center gap-2">
                    {g.emoji && <span className="text-base">{g.emoji}</span>}
                    <span className={cn('font-heading text-xs font-semibold', gadget === g.value ? 'text-secondary' : 'text-foreground')}>
                      {g.label}
                    </span>
                  </div>
                  {g.desc && (
                    <p className="text-[9px] text-muted-foreground mt-0.5 ml-6">{g.desc}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Kép */}
          <div>
            <label className="label-caps text-[9px] text-muted-foreground block mb-1">Profilkép</label>
            <div className="flex items-center gap-3">
              {imgPreview ? (
                <img src={imgPreview} alt="preview" className="w-16 h-16 object-cover rounded-full border-2 border-border"/>
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-border bg-muted flex items-center justify-center">
                  <Anchor className="size-6 text-muted-foreground" strokeWidth={1.5}/>
                </div>
              )}
              <input type="file" accept="image/*"
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const resized = await resizeImage(file)
                    setImgFile(resized)
                    setImgPreview(URL.createObjectURL(resized))
                  }
                }}
                className="flex-1 text-sm text-muted-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-secondary/15 file:px-3 file:py-1 file:text-xs file:font-heading file:font-semibold file:text-secondary"/>
            </div>
          </div>
        </div>

        {/* Jobb: képességek */}
        <div className="space-y-4">
          <div className="rounded-sm border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="label-caps text-[9px] text-muted-foreground">Képességek</p>
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-lg font-bold text-foreground">{avgSkill}</span>
                <span className="label-caps text-[9px] text-muted-foreground">átlag</span>
              </div>
            </div>

            {/* Skill bar vizuális */}
            <div className="flex gap-1 mb-4 h-20 items-end">
              {[
                { label: 'TRIM', value: skillTrim, color: 'bg-secondary' },
                { label: 'TAKT', value: skillTactic, color: 'bg-accent' },
                { label: 'NAV', value: skillNav, color: 'bg-foreground' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="label-caps text-[8px] text-muted-foreground">{value}</span>
                  <div className="w-full rounded-sm overflow-hidden bg-border" style={{ height: '48px' }}>
                    <div className={`${color} w-full rounded-sm transition-all`} style={{ height: `${value}%` }}/>
                  </div>
                  <span className="label-caps text-[7px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <SkillBar label="Trim & Vitorlázat" value={skillTrim} onChange={setSkillTrim}/>
              <SkillBar label="Taktika" value={skillTactic} onChange={setSkillTactic}/>
              <SkillBar label="Navigáció" value={skillNav} onChange={setSkillNav}/>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => onSave({ name, description: bio, rental_credits: hireCost, available, gadget, sail_rating: skillTrim, weather_rating: skillTactic, helm_rating: skillNav, _imgFile: imgFile })}
          className="flex-1 flex items-center justify-center gap-2 rounded-sm bg-secondary py-2 font-heading text-sm font-semibold text-secondary-foreground">
          <Save className="size-4"/>{initial?.id ? 'Mentés' : 'Létrehozás'}
        </button>
        <button onClick={onCancel} className="rounded-sm border border-border px-4 py-2 text-sm text-muted-foreground">Mégse</button>
      </div>
    </div>
  )
}

export default function CaptainsPage() {
  const [captains, setCaptains] = useState<Captain[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  async function load() {
    setLoading(true)
    try {
      const list = await getPocketBase().collection('captains').getFullList({ sort: '-id' })
      setCaptains(list as Captain[])
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save(data: any, id?: string) {
    try {
      const { _imgFile, ...rest } = data
      const formData = new FormData()
      Object.entries(rest).forEach(([k, v]) => { if (v !== null && v !== undefined) formData.append(k, String(v)) })
      if (_imgFile) formData.append('image', _imgFile)
      if (id) {
        await getPocketBase().collection('captains').update(id, formData)
        setEditId(null)
        flash('✓ Mentve')
      } else {
        await getPocketBase().collection('captains').create(formData)
        setShowNew(false)
        flash('✓ Kapitány létrehozva')
      }
      load()
    } catch (e) { flash('⚠ Hiba: ' + (e as any)?.message) }
  }

  async function deleteCaptain(id: string) {
    if (!confirm('Biztosan törlöd?')) return
    try { await getPocketBase().collection('captains').delete(id); flash('✓ Törölve'); load() }
    catch (e) { flash('⚠ Hiba') }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Kapitányok</h1>
          <p className="label-caps text-[9px] text-muted-foreground">{captains.length} bérelhető kapitány</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="label-caps text-[10px] text-secondary bg-secondary/10 px-2 py-1 rounded-sm">{msg}</span>}
          <button onClick={() => { setShowNew(v => !v); setEditId(null) }}
            className="flex items-center gap-2 rounded-sm bg-foreground px-3 py-2 font-heading text-sm font-semibold text-background hover:bg-secondary transition-colors">
            <Plus className="size-4"/>Új kapitány
          </button>
        </div>
      </div>

      {showNew && <CaptainForm onSave={data => save(data)} onCancel={() => setShowNew(false)}/>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Betöltés...</p>
      ) : captains.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-8 text-center">
          <Anchor className="size-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">Még nincs kapitány</p>
        </div>
      ) : (
        <div className="space-y-2">
          {captains.map(cap => (
            <div key={cap.id} className="rounded-sm border border-border bg-card overflow-hidden">
              {editId === cap.id ? (
                <div className="p-4">
                  <CaptainForm initial={cap} onSave={data => save(data, cap.id)} onCancel={() => setEditId(null)}/>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full border-2 border-border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {cap.image ? (
                      <img src={`http://127.0.0.1:8090/api/files/captains/${cap.id}/${cap.image}`} alt={cap.name} className="w-full h-full object-cover"/>
                    ) : (
                      <Anchor className="size-5 text-muted-foreground" strokeWidth={1.5}/>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-heading text-sm font-semibold text-foreground">{cap.name}</p>
                      <span className={cn('label-caps text-[8px] px-1.5 py-0.5 rounded-sm', RANKS[1]?.color || 'bg-muted text-muted-foreground')}>
                        {RANKS[1]?.label || 'advanced'}
                      </span>
                      <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                        {cap.rental_credits} kr
                      </span>
                      {cap.gadget && cap.gadget !== '' && (() => {
                        const g = GADGETS.find(g => g.value === cap.gadget)
                        return g ? (
                          <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-accent/15 text-accent">
                            {g.emoji} {g.label}
                          </span>
                        ) : null
                      })()}
                      {!cap.available && (
                        <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-destructive/15 text-destructive">Nem elérhető</span>
                      )}
                    </div>

                    {/* Skill vizuális */}
                    <div className="flex items-center gap-3">
                      {[
                        { label: 'Vitorlázat', value: cap.sail_rating },
                        { label: 'Időjárás', value: cap.weather_rating },
                        { label: 'Navigáció', value: cap.helm_rating },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <span className="label-caps text-[8px] text-muted-foreground">{label}</span>
                          <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                            <div className="h-full bg-secondary rounded-full" style={{ width: `${value}%` }}/>
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setEditId(cap.id)}
                      className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-foreground">
                      <Edit2 className="size-3.5"/>
                    </button>
                    <button onClick={() => deleteCaptain(cap.id)}
                      className="rounded-sm bg-muted p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3.5"/>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
