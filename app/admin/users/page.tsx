'use client'

import { useEffect, useState } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { Search, Edit2, Save, X, Users, Coins, Trophy, Ban, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface User {
  id: string
  name: string
  email: string
  verified: boolean
  created: string
}

interface PlayerProfile {
  id: string
  player_id: string
  credits: number
  xp: number
  rank: string
  total_races: number
  wins: number
}

interface PlayerRace {
  id: string
  player_id: string
  race_id: string
  boat_name?: string
  boat_id?: string
  captain_id?: string
  joined_at: string
  status?: string
  expand?: {
    race_id?: { id: string; name: string; status: string }
    boat_id?: { id: string; name: string; class: string }
    captain_id?: { id: string; name: string }
  }
}

const RANKS = [
  { value: 'beginner', label: 'Kezdő',  color: 'bg-muted text-muted-foreground' },
  { value: 'advanced', label: 'Haladó', color: 'bg-secondary/15 text-secondary' },
  { value: 'pro',      label: 'Profi',  color: 'bg-accent/15 text-accent' },
  { value: 'master',   label: 'Mester', color: 'bg-destructive/15 text-destructive' },
]

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editCredits, setEditCredits] = useState(0)
  const [editXp, setEditXp] = useState(0)
  const [editRank, setEditRank] = useState('beginner')
  const [editName, setEditName] = useState('')
  const [msg, setMsg] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [playerRaces, setPlayerRaces] = useState<Record<string, PlayerRace[]>>({})
  const [loadingRaces, setLoadingRaces] = useState<string | null>(null)

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  async function load() {
    setLoading(true)
    try {
      const pb = getPocketBase()
      const [userList, profileList] = await Promise.all([
        pb.collection('users').getFullList({ sort: 'name' }),
        pb.collection('player_profiles').getFullList(),
      ])
      setUsers(userList as User[])
      const profileMap: Record<string, PlayerProfile> = {}
      profileList.forEach((p: any) => { profileMap[p.player_id] = p as PlayerProfile })
      setProfiles(profileMap)
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadPlayerRaces(userId: string) {
    if (playerRaces[userId]) {
      setExpandedId(expandedId === userId ? null : userId)
      return
    }
    setLoadingRaces(userId)
    try {
      const pb = getPocketBase()
      const prs = await pb.collection('player_races').getFullList({
        filter: `player_id="${userId}"`,
        sort: '-id',
      })

      // Külön betöltjük a verseny és hajó neveket
      const enriched = await Promise.all(prs.map(async (pr: any) => {
        const result: PlayerRace = { ...pr }
        try {
          if (pr.race_id) {
            const race = await pb.collection('races').getOne(pr.race_id)
            result.expand = { ...result.expand, race_id: { id: race.id, name: race.name, status: race.status } }
          }
        } catch (e) {}
        try {
          if (pr.boat_id) {
            const boat = await pb.collection('boats').getOne(pr.boat_id)
            result.expand = { ...result.expand, boat_id: { id: boat.id, name: boat.name, class: boat.class } }
          }
        } catch (e) {}
        try {
          if (pr.captain_id) {
            const cap = await pb.collection('captains').getOne(pr.captain_id)
            result.expand = { ...result.expand, captain_id: { id: cap.id, name: cap.name } }
          }
        } catch (e) {}
        return result
      }))

      setPlayerRaces(prev => ({ ...prev, [userId]: enriched }))
      setExpandedId(userId)
    } catch (e) { console.error(e) }
    setLoadingRaces(null)
  }

  function startEdit(user: User) {
    const profile = profiles[user.id]
    setEditId(user.id)
    setEditName(user.name || '')
    setEditCredits(profile?.credits || 0)
    setEditXp(profile?.xp || 0)
    setEditRank(profile?.rank || 'beginner')
  }

  async function saveUser() {
    if (!editId) return
    try {
      const pb = getPocketBase()

      // Név frissítése
      await pb.collection('users').update(editId, { name: editName })

      // Profil frissítése
      const profile = profiles[editId]
      if (profile) {
        await pb.collection('player_profiles').update(profile.id, {
          credits: editCredits,
          xp: editXp,
          rank: editRank,
        })
      } else {
        await pb.collection('player_profiles').create({
          player_id: editId,
          credits: editCredits,
          xp: editXp,
          rank: editRank,
        })
      }

      setEditId(null)
      flash('✓ Mentve')
      load()
    } catch (e) { flash('⚠ Hiba: ' + (e as any)?.message) }
  }

  async function addCredits(userId: string, amount: number) {
    try {
      const pb = getPocketBase()
      const profile = profiles[userId]
      if (profile) {
        await pb.collection('player_profiles').update(profile.id, {
          credits: (profile.credits || 0) + amount
        })
      } else {
        await pb.collection('player_profiles').create({
          player_id: userId, credits: amount, xp: 0, rank: 'beginner'
        })
      }
      flash(`✓ +${amount} kr hozzáadva`)
      load()
    } catch (e) { flash('⚠ Hiba') }
  }

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Felhasználók</h1>
          <p className="label-caps text-[9px] text-muted-foreground">{users.length} regisztrált felhasználó</p>
        </div>
        {msg && <span className="label-caps text-[10px] text-secondary bg-secondary/10 px-2 py-1 rounded-sm">{msg}</span>}
      </div>

      {/* Keresés */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Keresés név vagy email alapján..."
          className="w-full rounded-sm border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-secondary"/>
      </div>

      {/* Összesítő */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Összesen', value: users.length, icon: Users },
          { label: 'Összes kredit', value: Object.values(profiles).reduce((s, p) => s + (p.credits||0), 0) + ' kr', icon: Coins },
          { label: 'Összes XP', value: Object.values(profiles).reduce((s, p) => s + (p.xp||0), 0), icon: Trophy },
          { label: 'Mesterek', value: Object.values(profiles).filter(p => p.rank === 'master').length, icon: Trophy },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-sm border border-border bg-card p-3 flex items-center gap-3">
            <Icon className="size-5 text-muted-foreground" strokeWidth={1.5}/>
            <div>
              <p className="label-caps text-[9px] text-muted-foreground">{label}</p>
              <p className="font-heading text-lg font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* User lista */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Betöltés...</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const profile = profiles[user.id]
            const rankInfo = RANKS.find(r => r.value === (profile?.rank || 'beginner'))

            return (
              <div key={user.id} className="rounded-sm border border-border bg-card overflow-hidden">
                {editId === user.id ? (
                  <div className="p-4 space-y-3">
                    <p className="font-heading text-sm font-semibold text-foreground">Szerkesztés: {user.email}</p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div>
                        <label className="label-caps text-[9px] text-muted-foreground block mb-1">Megjelenített név</label>
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
                      </div>
                      <div>
                        <label className="label-caps text-[9px] text-muted-foreground block mb-1">Kredit</label>
                        <input type="number" min={0} value={editCredits} onChange={e => setEditCredits(Number(e.target.value))}
                          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
                      </div>
                      <div>
                        <label className="label-caps text-[9px] text-muted-foreground block mb-1">XP</label>
                        <input type="number" min={0} value={editXp} onChange={e => setEditXp(Number(e.target.value))}
                          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
                      </div>
                      <div>
                        <label className="label-caps text-[9px] text-muted-foreground block mb-2">Rang</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {RANKS.map(({ value, label }) => (
                            <button key={value} onClick={() => setEditRank(value)}
                              className={cn('rounded-sm border px-2.5 py-1 font-heading text-xs font-semibold transition-all',
                                editRank === value ? 'border-secondary bg-secondary/15 text-secondary' : 'border-border text-muted-foreground')}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={saveUser}
                        className="flex items-center gap-2 rounded-sm bg-secondary px-4 py-2 font-heading text-sm font-semibold text-secondary-foreground">
                        <Save className="size-4"/>Mentés
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="rounded-sm border border-border px-4 py-2 text-sm text-muted-foreground">
                        Mégse
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                      <span className="font-heading text-sm font-bold text-secondary">
                        {(user.name || user.email)[0].toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-heading text-sm font-semibold text-foreground">
                          {user.name || '—'}
                        </p>
                        <span className={cn('label-caps text-[8px] px-1.5 py-0.5 rounded-sm', rankInfo?.color)}>
                          {rankInfo?.label}
                        </span>
                        {user.verified && (
                          <CheckCircle className="size-3 text-secondary"/>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{user.email}</span>
                        {profile && (
                          <>
                            <span className="flex items-center gap-1">
                              <Coins className="size-3"/>{profile.credits || 0} kr
                            </span>
                            <span className="flex items-center gap-1">
                              <Trophy className="size-3"/>{profile.xp || 0} XP
                            </span>
                            {profile.total_races > 0 && (
                              <span>{profile.total_races} verseny · {profile.wins || 0} győzelem</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Nevezések gomb */}
                      <button onClick={() => loadPlayerRaces(user.id)}
                        className={cn("rounded-sm border px-2 py-1.5 font-heading text-[10px] font-semibold transition-colors",
                          expandedId === user.id ? 'border-secondary bg-secondary/15 text-secondary' : 'border-border text-muted-foreground hover:border-secondary')}
                        title="Nevezések">
                        {loadingRaces === user.id ? '...' : '⛵ Nevezések'}
                      </button>
                      {/* Gyors kredit hozzáadás */}
                      <button onClick={() => addCredits(user.id, 50)}
                        className="rounded-sm border border-border px-2 py-1.5 font-heading text-[10px] font-semibold text-muted-foreground hover:text-secondary hover:border-secondary transition-colors"
                        title="+50 kr">
                        +50kr
                      </button>
                      <button onClick={() => addCredits(user.id, 200)}
                        className="rounded-sm border border-border px-2 py-1.5 font-heading text-[10px] font-semibold text-muted-foreground hover:text-secondary hover:border-secondary transition-colors"
                        title="+200 kr">
                        +200kr
                      </button>
                      <button onClick={() => startEdit(user)}
                        className="rounded-sm border border-border p-1.5 text-muted-foreground hover:text-foreground">
                        <Edit2 className="size-3.5"/>
                      </button>
                    </div>
                  </div>
                )}

                {/* Kibontható nevezés panel */}
                {expandedId === user.id && (
                  <div className="border-t border-border bg-muted/30 px-4 py-3">
                    {!playerRaces[user.id] || playerRaces[user.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nincs nevezés</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="label-caps text-[9px] text-muted-foreground mb-2">Nevezések ({playerRaces[user.id].length})</p>
                        {playerRaces[user.id].map(pr => {
                          const race = pr.expand?.race_id
                          const boat = pr.expand?.boat_id
                          const captain = pr.expand?.captain_id
                          const statusColor: Record<string,string> = {
                            active: 'text-green-600', finished: 'text-muted-foreground',
                            idle: 'text-secondary', published: 'text-accent'
                          }
                          return (
                            <div key={pr.id} className="flex items-center gap-3 rounded-sm border border-border bg-card px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-heading text-xs font-semibold text-foreground">
                                    {race?.name || pr.race_id}
                                  </p>
                                  <span className={cn('label-caps text-[8px]', statusColor[race?.status || ''] || 'text-muted-foreground')}>
                                    {race?.status || '—'}
                                  </span>
                                </div>
                                <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                                  {boat && (
                                    <span>⛵ {boat.name} <span className="opacity-60">({boat.class?.toUpperCase()})</span></span>
                                  )}
                                  {pr.boat_name && !boat && (
                                    <span>⛵ {pr.boat_name}</span>
                                  )}
                                  {captain && (
                                    <span>⚓ {captain.name}</span>
                                  )}
                                  <span className="opacity-50">{new Date(pr.joined_at).toLocaleString('hu-HU')}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
