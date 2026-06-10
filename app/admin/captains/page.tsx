'use client'

import { useEffect, useState } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import {
  Plus, Trash2, Edit2, Anchor, Save,
  Bot, Coins, Timer, Shield, Wind as WindIcon, Link2, Sailboat,
  Waves, Wrench, Trophy, Star, Sunrise, Eye, Leaf, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/panel'

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
  { value: '',              label: '— Nincs gadget —',   Icon: null,        desc: '' },
  { value: 'tech_guru',     label: 'Tech guru',          Icon: Bot,         desc: 'Autopilot ingyen megvásárolva' },
  { value: 'alkudozo',      label: 'Alkudozó',           Icon: Coins,       desc: 'Nevezési díj -40%' },
  { value: 'rajtmester',    label: 'Rajtmester',         Icon: Timer,       desc: 'Induláskor +30mp előny' },
  { value: 'viharlovas',    label: 'Viharlovas',         Icon: Shield,      desc: 'Viharban nincs sebesség csökkentés' },
  { value: 'szelLovas',     label: 'Széllovas',          Icon: WindIcon,    desc: 'Hátszélben +15% sebesség' },
  { value: 'kotelmagus',    label: 'Kötélmágus',         Icon: Link2,       desc: 'Vitorlacsere penalty 0 perc' },
  { value: 'spinn_mester',  label: 'Spinnaker mester',   Icon: Sailboat,    desc: 'Spinnaker trim automatikusan 100%' },
  { value: 'driftvadasz',   label: 'Driftvadász',        Icon: Waves,       desc: 'Drift 50%-kal csökkentve' },
  { value: 'szerelo',       label: 'Szerelő',            Icon: Wrench,      desc: '1x Davy Jones vagy vitorlacsere penalty törlés' },
  { value: 'bajnok',        label: 'Bajnok',             Icon: Trophy,      desc: 'Pontszorzó x1.5 ha top 3' },
  { value: 'trim_mester',   label: 'Trim-mester',        Icon: Star,        desc: 'Optimális trim gomb ingyen' },
  { value: 'hajnali_madar', label: 'Hajnali madár',      Icon: Sunrise,     desc: 'Versenyidő -5%' },
  { value: 'kem',           label: 'Kém',                Icon: Eye,         desc: 'Látja mások vitorlabeállítását' },
  { value: 'algamester',    label: 'Algamester',         Icon: Leaf,        desc: '+10% sebesség sekély/parti szakaszon' },
  { value: 'custom',        label: 'Egyéni gadget',      Icon: Sparkles,    desc: 'Bővíthető — később meghatározható' },
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
    img.crossOrigin = 'anonymous'
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
      <p className="font-heading text-sm font-semibold text-foreground">{initial?.id ? 'Kapitány szerkesztése' : 'Új kapitány'}</p>

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
              {GADGETS.map(g => {
                const Icon = g.Icon
                return (
                  <button key={g.value} type="button" onClick={() => setGadget(g.value)}
                    className={cn(
                      'rounded-sm border px-3 py-2 text-left transition-all',
                      gadget === g.value
                        ? 'border-secondary bg-secondary/15'
                        : 'border-border hover:border-secondary/40'
                    )}>
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className={cn('size-4 shrink-0', gadget === g.value ? 'text-secondary' : 'text-muted-foreground')} strokeWidth={1.75} />}
                      <span className={cn('font-heading text-xs font-semibold', gadget === g.value ? 'text-secondary' : 'text-foreground')}>
                        {g.label}
                      </span>
                    </div>
                    {g.desc && (
                      <p className="text-[9px] text-muted-foreground mt-0.5 ml-6">{g.desc}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Kép */}
          <div>
            <label className="label-caps text-[9px] text-muted-foreground block mb-1">Profilkép</label>
            <div className="flex items-center gap-3">
              {imgPreview ? (
                <img src={imgPreview || "/placeholder.svg"} alt="Kapitány előnézeti képe" className="w-16 h-16 object-cover rounded-full border-2 border-border"/>
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
  const [msgErr, setMsgErr] = useState(false)

  function flash(m: string, err = false) { setMsg(m); setMsgErr(err); setTimeout(() => setMsg(''), 2500) }

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
        flash('Mentve')
      } else {
        await getPocketBase().collection('captains').create(formData)
        setShowNew(false)
        flash('Kapitány létrehozva')
      }
      load()
    } catch (e) { flash('Hiba: ' + (e as any)?.message, true) }
  }

  async function deleteCaptain(id: string) {
    if (!confirm('Biztosan törlöd?')) return
    try { await getPocketBase().collection('captains').delete(id); flash('Törölve'); load() }
    catch (e) { flash('Hiba', true) }
  }

  return (
    <main className="min-h-screen bg-background p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="instrument-bezel flex size-11 items-center justify-center">
              <Anchor className="size-5 text-[var(--gold)]" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-foreground leading-tight">Kapitányok</h1>
              <p className="label-caps text-[9px] text-muted-foreground">CREW-REG · {captains.length} bérelhető kapitány</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {msg && (
              <span className={cn(
                'label-caps text-[10px] px-2 py-1 rounded-sm',
                msgErr ? 'text-destructive bg-destructive/10' : 'text-secondary bg-secondary/10'
              )}>{msg}</span>
            )}
            <button onClick={() => { setShowNew(v => !v); setEditId(null) }}
              className="flex items-center gap-2 rounded-sm bg-foreground px-3 py-2 font-heading text-sm font-semibold text-background hover:bg-secondary transition-colors">
              <Plus className="size-4"/>Új kapitány
            </button>
          </div>
        </header>

        <Panel title="Legénység nyilvántartás" code="CREW-01">
          <div className="space-y-3">
            {showNew && <CaptainForm onSave={data => save(data)} onCancel={() => setShowNew(false)}/>}

            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Betöltés...</p>
            ) : captains.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border bg-background/50 p-8 text-center">
                <Anchor className="size-8 text-muted-foreground mx-auto mb-2" strokeWidth={1.5}/>
                <p className="text-sm text-muted-foreground">Még nincs kapitány</p>
              </div>
            ) : (
              <div className="space-y-2">
                {captains.map(cap => (
                  <div key={cap.id} className="rounded-sm border border-border bg-background/60 overflow-hidden">
                    {editId === cap.id ? (
                      <div className="p-3">
                        <CaptainForm initial={cap} onSave={data => save(data, cap.id)} onCancel={() => setEditId(null)}/>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3">
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
                              {RANKS[1]?.label || 'Haladó'}
                            </span>
                            <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                              {cap.rental_credits} kr
                            </span>
                            {cap.gadget && cap.gadget !== '' && (() => {
                              const g = GADGETS.find(g => g.value === cap.gadget)
                              if (!g) return null
                              const Icon = g.Icon
                              return (
                                <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-accent/15 text-accent flex items-center gap-1">
                                  {Icon && <Icon className="size-2.5" strokeWidth={2} />}{g.label}
                                </span>
                              )
                            })()}
                            {!cap.available && (
                              <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-destructive/15 text-destructive">Nem elérhető</span>
                            )}
                          </div>

                          {/* Skill vizuális */}
                          <div className="flex items-center gap-3 flex-wrap">
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
                          <button onClick={() => setEditId(cap.id)} aria-label="Szerkesztés"
                            className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-foreground">
                            <Edit2 className="size-3.5"/>
                          </button>
                          <button onClick={() => deleteCaptain(cap.id)} aria-label="Törlés"
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
        </Panel>
      </div>
    </main>
  )
}
