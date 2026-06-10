'use client'

import { useEffect, useState } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { Plus, Trash2, Edit2, Ship, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Boat {
  id: string
  name: string
  class: string
  owner_id?: string
  sail_number?: string
  description?: string
  image?: string
  collectionId?: string
  created: string
}

const BOAT_CLASSES = [
  { value: 'ys1', label: 'Ys.I',  desc: '1200–1800 kg' },
  { value: 'ys2', label: 'Ys.II', desc: '800–1200 kg' },
  { value: 'ys3', label: 'Ys.III',desc: '400–800 kg' },
]

interface User { id: string; name: string; email: string }


async function resizeImage(file: File, maxW = 800, maxH = 600, quality = 0.82): Promise<File> {
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
        resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.src = url
  })
}

function BoatForm({ initial, users, onSave, onCancel }: {
  initial?: Partial<Boat>, users: User[],
  onSave: (data: any) => void, onCancel: () => void
}) {
  const [name, setName]           = useState(initial?.name || '')
  const [cls, setCls]             = useState(initial?.class || 'ys1')
  const [sailNum, setSailNum]     = useState(initial?.sail_number || '')
  const [desc, setDesc]           = useState(initial?.description || '')
  const [ownerId, setOwnerId]     = useState(initial?.owner_id || '')
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState<string>(initial?.image ? `http://127.0.0.1:8090/api/files/boats/${initial.id}/${initial.image}` : '')

  return (
    <div className="rounded-sm border border-secondary/40 bg-secondary/5 p-4 space-y-3">
      <p className="font-heading text-sm font-semibold text-foreground">
        {initial?.id ? 'Hajó szerkesztése' : 'Új hajó'}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <label className="label-caps text-[9px] text-muted-foreground block mb-1">Hajó neve *</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="pl. Villám, Sirály..."
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
        </div>
        <div>
          <label className="label-caps text-[9px] text-muted-foreground block mb-1">Vitorlaszám</label>
          <input value={sailNum} onChange={e => setSailNum(e.target.value)}
            placeholder="pl. HUN-1234"
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
        </div>
      </div>

      {/* Osztály */}
      <div>
        <label className="label-caps text-[9px] text-muted-foreground block mb-2">Hajóosztály</label>
        <div className="flex gap-2">
          {BOAT_CLASSES.map(({ value, label, desc: d }) => (
            <button key={value} type="button" onClick={() => setCls(value)}
              className={cn(
                'flex-1 rounded-sm border-2 px-2 py-2 font-heading text-xs font-semibold text-left transition-all',
                cls === value
                  ? 'border-secondary bg-secondary/15 text-secondary'
                  : 'border-border text-muted-foreground hover:border-secondary/40'
              )}>
              <div>{label}</div>
              <div className="text-[9px] font-normal opacity-60">{d}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tulajdonos */}
      <div>
        <label className="label-caps text-[9px] text-muted-foreground block mb-1">Tulajdonos</label>
        <select value={ownerId} onChange={e => setOwnerId(e.target.value)}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary">
          <option value="">— Nincs tulajdonos —</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name || u.email}</option>
          ))}
        </select>
      </div>

      {/* Kép feltöltés */}
      <div>
        <label className="label-caps text-[9px] text-muted-foreground block mb-1">Hajó képe</label>
        <div className="flex items-center gap-3">
          {imgPreview && (
            <img src={imgPreview} alt="preview" className="w-16 h-16 object-cover rounded-sm border border-border"/>
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

      {/* Leírás */}
      <div>
        <label className="label-caps text-[9px] text-muted-foreground block mb-1">Leírás</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
          placeholder="Hajó jellemzői, különleges tulajdonságok..."
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary resize-none"/>
      </div>

      <div className="flex gap-2">
        <button onClick={() => onSave({ name, class: cls, sail_number: sailNum, description: desc, owner_id: ownerId || null, _imgFile: imgFile })}
          className="flex-1 flex items-center justify-center gap-2 rounded-sm bg-secondary py-2 font-heading text-sm font-semibold text-secondary-foreground">
          <Save className="size-4"/>{initial?.id ? 'Mentés' : 'Létrehozás'}
        </button>
        <button onClick={onCancel}
          className="rounded-sm border border-border px-4 py-2 text-sm text-muted-foreground">
          Mégse
        </button>
      </div>
    </div>
  )
}

export default function BoatsPage() {
  const [boats, setBoats] = useState<Boat[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  async function load() {
    setLoading(true)
    try {
      const pb = getPocketBase()
      const [boatList, userList] = await Promise.all([
        pb.collection('boats').getFullList({ sort: '-id' }),
        pb.collection('users').getFullList({ sort: 'name' }),
      ])
      setBoats(boatList as Boat[])
      setUsers(userList as User[])
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createBoat(data: any) {
    try {
      const { _imgFile, ...rest } = data
      const formData = new FormData()
      Object.entries(rest).forEach(([k, v]) => { if (v !== null && v !== undefined) formData.append(k, String(v)) })
      if (_imgFile) formData.append('image', _imgFile)
      await getPocketBase().collection('boats').create(formData)
      setShowNew(false)
      flash('✓ Hajó létrehozva')
      load()
    } catch (e) { flash('⚠ Hiba: ' + (e as any)?.message) }
  }

  async function updateBoat(id: string, data: any) {
    try {
      const { _imgFile, ...rest } = data
      const formData = new FormData()
      Object.entries(rest).forEach(([k, v]) => { if (v !== null && v !== undefined) formData.append(k, String(v)) })
      if (_imgFile) formData.append('image', _imgFile)
      await getPocketBase().collection('boats').update(id, formData)
      setEditId(null)
      flash('✓ Mentve')
      load()
    } catch (e) { flash('⚠ Hiba') }
  }

  async function deleteBoat(id: string) {
    if (!confirm('Biztosan törlöd?')) return
    try {
      await getPocketBase().collection('boats').delete(id)
      flash('✓ Törölve')
      load()
    } catch (e) { flash('⚠ Hiba') }
  }

  function getOwnerName(ownerId?: string) {
    if (!ownerId) return null
    const u = users.find(u => u.id === ownerId)
    return u?.name || u?.email || null
  }

  const classInfo = (cls: string) => BOAT_CLASSES.find(b => b.value === cls)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Hajók</h1>
          <p className="label-caps text-[9px] text-muted-foreground">{boats.length} hajó</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="label-caps text-[10px] text-secondary bg-secondary/10 px-2 py-1 rounded-sm">{msg}</span>}
          <button onClick={() => { setShowNew(v => !v); setEditId(null) }}
            className="flex items-center gap-2 rounded-sm bg-foreground px-3 py-2 font-heading text-sm font-semibold text-background hover:bg-secondary transition-colors">
            <Plus className="size-4"/>Új hajó
          </button>
        </div>
      </div>

      {showNew && <BoatForm users={users} onSave={createBoat} onCancel={() => setShowNew(false)}/>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Betöltés...</p>
      ) : boats.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-8 text-center">
          <Ship className="size-8 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">Még nincs hajó</p>
        </div>
      ) : (
        <div className="space-y-2">
          {boats.map(boat => (
            <div key={boat.id} className="rounded-sm border border-border bg-card overflow-hidden">
              {editId === boat.id ? (
                <div className="p-4">
                  <BoatForm initial={boat} users={users}
                    onSave={data => updateBoat(boat.id, data)}
                    onCancel={() => setEditId(null)}/>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4">
                  {/* Hajó ikon / kép */}
                  <div className="w-12 h-12 rounded-sm border border-border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {boat.image ? (
                      <img src={`http://127.0.0.1:8090/api/files/boats/${boat.id}/${boat.image}`} alt={boat.name} className="w-full h-full object-cover"/>
                    ) : (
                      <Ship className="size-6 text-muted-foreground" strokeWidth={1.5}/>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-heading text-sm font-semibold text-foreground">{boat.name}</p>
                      {boat.sail_number && (
                        <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                          {boat.sail_number}
                        </span>
                      )}
                      <span className={cn(
                        'label-caps text-[8px] px-1.5 py-0.5 rounded-sm',
                        boat.class === 'ys1' ? 'bg-secondary/15 text-secondary' :
                        boat.class === 'ys2' ? 'bg-accent/15 text-accent' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {classInfo(boat.class)?.label || boat.class}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                      {getOwnerName(boat.owner_id) && (
                        <span>👤 {getOwnerName(boat.owner_id)}</span>
                      )}
                      {boat.description && (
                        <span className="truncate max-w-xs">{boat.description}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setEditId(boat.id)}
                      className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-foreground">
                      <Edit2 className="size-3.5"/>
                    </button>
                    <button onClick={() => deleteBoat(boat.id)}
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
