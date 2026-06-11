'use client'

import { Sidebar } from '@/components/sidebar'

import { useEffect, useState, useRef } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { useRouter } from 'next/navigation'
import { Flag, Ship, Anchor, Trophy, Calendar, Wind, Users, Send, ChevronRight, Radio, Medal } from 'lucide-react'
import { kmhToKnots } from '@/lib/units'

interface Race {
  id: string; name: string; status: string
  scheduled_start?: string; actual_start?: string
  description?: string; entry_fee?: number
  min_rank?: string; boat_classes?: string
  course_id?: string; poster?: string
}

interface ChatMsg { id: string; user: string; text: string; time: string; isSystem?: boolean }

const DIRS = ['É','ÉK','K','DK','D','DNy','Ny','ÉNy']
const dirLabel = (deg: number) => DIRS[Math.round(((deg%360)+360)%360/45)%8]

function useCountdown(target?: string) {
  const [diff, setDiff] = useState(0)
  useEffect(() => {
    if (!target) return
    const update = () => setDiff(Math.max(0, new Date(target).getTime() - Date.now()))
    update(); const i = setInterval(update, 1000); return () => clearInterval(i)
  }, [target])
  const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000)
  const m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000)
  return { d, h, m, s, done: diff === 0 }
}

function useElapsed(start?: string) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!start) return
    const update = () => setElapsed(Math.floor((Date.now() - new Date(start).getTime()) / 1000))
    update(); const i = setInterval(update, 1000); return () => clearInterval(i)
  }, [start])
  const h = Math.floor(elapsed/3600), m = Math.floor((elapsed%3600)/60), s = elapsed%60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function AuthModal({ mode, onClose, onSuccess }: { mode: 'login'|'register', onClose: () => void, onSuccess: (name: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!email || !password) { setErr('Töltsd ki a mezőket!'); return }
    setLoading(true); setErr('')
    try {
      const pb = getPocketBase()
      if (mode === 'register') {
        if (!name) { setErr('Add meg a neved!'); setLoading(false); return }
        await pb.collection('users').create({ email, password, passwordConfirm: password, name })
        await pb.collection('users').authWithPassword(email, password)
        // Profil létrehozása
        try {
          await pb.collection('player_profiles').create({
            player_id: pb.authStore.record?.id,
            display_name: name,
            credits: 500,
            xp: 0,
            total_races: 0,
            total_wins: 0,
          })
        } catch {}
      } else {
        await pb.collection('users').authWithPassword(email, password)
      }
      onSuccess(pb.authStore.record?.name || email)
    } catch (e: any) {
      setErr(e?.message || 'Hibás adatok')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-foreground/85 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-7 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Anchor className="size-4" strokeWidth={2} />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground">
            {mode === 'login' ? 'Bejelentkezés' : 'Regisztráció'}
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {mode === 'register' && (
            <div>
              <label className="label-caps mb-1 block text-[9px] text-muted-foreground">Megjelenített név</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Kapitány neve"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-secondary"/>
            </div>
          )}
          <div>
            <label className="label-caps mb-1 block text-[9px] text-muted-foreground">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-secondary"/>
          </div>
          <div>
            <label className="label-caps mb-1 block text-[9px] text-muted-foreground">Jelszó</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-secondary"/>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <button onClick={submit} disabled={loading}
            className="mt-1 w-full rounded-md bg-primary py-2.5 font-heading text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
            {loading ? 'Betöltés...' : mode === 'login' ? 'Bejelentkezés' : 'Regisztráció'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KikotoPage() {
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  const [races, setRaces] = useState<Race[]>([])
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)
  const [myRaces, setMyRaces] = useState<string[]>([])
  const [standings, setStandings] = useState<any[]>([])
  const [windSpeed, setWindSpeed] = useState(0)
  const [windDir, setWindDir] = useState(225)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [credits, setCredits] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [authModal, setAuthModal] = useState<'login'|'register'|null>(null)
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
  const [userFinished, setUserFinished] = useState(false)
  const [canEnterDeck, setCanEnterDeck] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const countdown = useCountdown(selectedRace?.scheduled_start)
  const elapsed = useElapsed(selectedRace?.actual_start)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMsgs])

  // Chat PocketBase realtime
  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()
    const raceId = selectedRace?.id || 'kikoto'

    function msgToChat(m: any): ChatMsg {
      const d = new Date(m.created)
      return {
        id: m.id,
        user: m.user_name || 'Versenyző',
        text: m.text,
        time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
      }
    }

    async function loadChat() {
      try {
        const msgs = await pb.collection('chat_messages').getFullList({
          filter: `race_id='${raceId}'`,
          sort: 'created',
          perPage: 50,
        })
        setChatMsgs([
          { id: 'sys', user: 'Rendszer', text: 'Üdv a kikötőben!', time: '', isSystem: true },
          ...msgs.map(msgToChat),
        ])
      } catch {}
    }

    loadChat()

    let unsub: (() => void) | null = null
    pb.collection('chat_messages').subscribe('*', (e) => {
      if (e.action === 'create' && e.record.race_id === raceId) {
        setChatMsgs(prev => {
          if (prev.find(m => m.id === e.record.id)) return prev
          return [...prev, msgToChat(e.record)]
        })
      }
    }).then(fn => { unsub = fn })

    return () => { unsub?.() }
  }, [mounted, selectedRace?.id])

  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()
    async function load() {
      try {
        const raceList = await pb.collection('races').getFullList({
          filter: "status='published' || status='active'", sort: 'scheduled_start',
        })
        setRaces(raceList as Race[])
        if (raceList.length > 0 && !selectedRace) setSelectedRace(raceList[0] as Race)
        if (pb.authStore.isValid) {
          setIsLoggedIn(true)
          setUsername(pb.authStore.record?.name || 'Kapitány')
          const profile = await pb.collection('player_profiles').getFirstListItem(
            `player_id="${pb.authStore.record?.id}"`, {}
          ).catch(() => null)
          if (profile) setCredits(profile.credits || 0)
          const myEntries = await pb.collection('player_races').getFullList({
            filter: `player_id="${pb.authStore.record?.id}"`,
          })
          setMyRaces(myEntries.map((e: any) => e.race_id))

          // Fedélzet hozzáférés ellenőrzése
          const activeRaces = await pb.collection('races').getFullList({
            filter: "status='active' || status='published'",
          })
          let canEnter = false
          let finished = false
          for (const race of activeRaces) {
            const joined = myEntries.some((e: any) => e.race_id === race.id)
            if (joined) {
              try {
                const pos = await pb.collection('race_positions').getFirstListItem(
                  `race_id="${race.id}" && player_id="${pb.authStore.record?.id}"`
                )
                if (pos.status === 'finished') {
                  finished = true
                } else {
                  canEnter = true
                }
              } catch {
                // Nincs még pozíció de be van nevezve — még indulhat
                if (race.status === 'active') canEnter = true
              }
            }
          }
          setUserFinished(finished)
          setCanEnterDeck(canEnter)
        }
      } catch (e) {}
    }
    load()
    const i = setInterval(load, 30000)
    return () => clearInterval(i)
  }, [mounted])

  useEffect(() => {
    if (!mounted || !selectedRace) return
    const pb = getPocketBase()
    async function loadRaceData() {
      try {
        const segs = await pb.collection('weather_segments').getFullList({
          filter: `race_id="${selectedRace.id}"`, sort: 'from_cp_index',
        })
        if (segs.length) {
          setWindSpeed(Math.round(kmhToKnots(segs[0].wind_speed)*10)/10)
          setWindDir(segs[0].wind_dir)
        } else {
          setWindSpeed(0)
        }
      } catch (e) {}
      try {
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${selectedRace.id}"`,
        })
        const sorted = positions.sort((a: any, b: any) =>
          (b.current_cp_index||0)-(a.current_cp_index||0) || (b.current_speed_kmh||0)-(a.current_speed_kmh||0)
        )
        const playerIds = [...new Set(sorted.map((p: any) => p.player_id).filter(Boolean))]
        const nameMap: Record<string, string> = {}
        await Promise.all(playerIds.map(async (pid: any) => {
          try {
            const user = await pb.collection('users').getOne(pid)
            nameMap[pid] = user.name || user.email || 'Versenyző'
          } catch { nameMap[pid] = 'Versenyző' }
        }))
        setStandings(sorted.map((p: any, i: number) => ({
          pos: i+1, playerId: p.player_id,
          name: nameMap[p.player_id] || 'Versenyző',
          speed: Math.round(kmhToKnots(p.current_speed_kmh||0)*10)/10,
          cp: p.current_cp_index||0,
        })))
      } catch (e) {}
    }
    loadRaceData()
    const i = setInterval(loadRaceData, 10000)
    return () => clearInterval(i)
  }, [mounted, selectedRace])

  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return
    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      const map = L.map(mapRef.current!, { center: [46.88,17.78], zoom: 11, zoomControl: true, attributionControl: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { opacity: 0.9 }).addTo(map)
      mapInstanceRef.current = map
      setTimeout(() => map.invalidateSize(), 300)
      if (selectedRace?.course_id) {
        try {
          const pb = getPocketBase()
          const course = await pb.collection('courses').getOne(selectedRace.course_id)
          const points = typeof course.points === 'string' ? JSON.parse(course.points) : (course.points || [])
          const mainPts = points.filter((p: any) => p.type !== 'waypoint')
          mainPts.forEach((pt: any, i: number) => {
            const color = pt.type==='start'?'#c42b1c':pt.type==='finish'?'#c8a030':'#2a6a7a'
            const icon = L.divIcon({
              html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${i+1}</div>`,
              className:'', iconAnchor:[13,13],
            })
            L.marker([pt.lat,pt.lng],{icon}).addTo(map).bindTooltip(pt.name,{permanent:true,direction:'top',offset:[0,-16]})
          })
          if (mainPts.length>1) {
            L.polyline(mainPts.map((p: any)=>[p.lat,p.lng]),{color:'#c42b1c',weight:2,opacity:0.5,dashArray:'6 4'}).addTo(map)
            map.fitBounds(L.latLngBounds(mainPts.map((p: any)=>[p.lat,p.lng])),{padding:[40,40]})
          }
        } catch (e) {}
      }
      async function updatePositions() {
        const pb = getPocketBase()
        try {
          const positions = await pb.collection('race_positions').getFullList({ filter: `race_id="${selectedRace!.id}"` })
          markersRef.current.forEach(m => m.remove()); markersRef.current = []
          const myId = pb.authStore.record?.id
          const sorted = [...positions].sort((a: any, b: any) =>
            (b.cp_index||0)-(a.cp_index||0) || (b.speed_kmh||0)-(a.speed_kmh||0)
          )
          const infoMap: Record<string, any> = {}
          await Promise.all(positions.map(async (pos: any) => {
            let userName = 'Versenyző'; let boatName = '—'; let boatClass = '—'; let boatType = '—'
            try {
              const user = await pb.collection('users').getOne(pos.player_id)
              userName = user.name || user.email || 'Versenyző'
            } catch {}
            try {
              const pr = await pb.collection('player_races').getFirstListItem(
                `race_id="${selectedRace!.id}" && player_id="${pos.player_id}"`
              )
              const boat = await pb.collection('boats').getOne(pr.boat_id)
              boatName = boat.name || '—'; boatType = boat.type_name || '—'
              const cm: Record<string,string> = {'9g4us1y1ye7afym':'Ys.I','40t0bopld7pwwo4':'Ys.II','lgtakoks0p1jnvd':'Ys.III'}
              boatClass = cm[boat.class_id] || '—'
            } catch {}
            const standing = sorted.findIndex((p: any) => p.player_id === pos.player_id) + 1
            infoMap[pos.player_id] = { name: userName, boatName, boatClass, boatType, pos: standing }
          }))

          positions.forEach((pos: any) => {
            const isMine = pos.player_id === myId
            const sz = isMine ? 32 : 24
            const info = infoMap[pos.player_id] || { name: 'Versenyző', boatName: '—', boatClass: '—', boatType: '—', pos: 0 }
            const speedKn = Math.round((pos.speed_kmh || 0) * 0.539957 * 10) / 10
            const tooltipHtml = `
              <div style="font-family:sans-serif;min-width:140px;line-height:1.5">
                <div style="font-weight:700;font-size:13px;margin-bottom:4px">${isMine ? 'Te' : info.name}</div>
                <div style="font-size:11px;color:#666">${info.boatName} · ${info.boatClass}</div>
                <div style="font-size:11px;color:#666">${info.boatType}</div>
                <div style="font-size:11px;margin-top:4px">
                  <span style="color:#c42b1c;font-weight:700">#${info.pos}</span>
                  <span style="color:#666;margin-left:8px">${speedKn} kn</span>
                  <span style="color:#666;margin-left:8px">CP ${pos.cp_index || 0}</span>
                </div>
              </div>`
            const icon = L.divIcon({
              html: `<div style="width:${sz}px;height:${sz}px;background:${isMine?'#c42b1c':'#2a6a7a'};border:2px solid ${isMine?'#c8a030':'rgba(255,255,255,0.6)'};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4)"><svg xmlns="http://www.w3.org/2000/svg" width="${isMine?16:12}" height="${isMine?16:12}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg></div>`,
              className:'', iconAnchor:[sz/2,sz/2],
            })
            const marker = L.marker([pos.lat||46.88,pos.lng||17.78],{icon}).addTo(map)
            marker.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -sz/2], opacity: 0.95 })
            markersRef.current.push(marker)
          })
        } catch (e) {}
      }
      updatePositions()
      const pi = setInterval(updatePositions, 10000)
      return () => clearInterval(pi)
    }
    initMap()
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [mounted, selectedRace?.id])

  async function joinRace(race: Race) {
    const pb = getPocketBase()
    if (!pb.authStore.isValid) { setAuthModal("login"); return }
    if (myRaces.includes(race.id) && canEnterDeck) { router.push('/dashboard'); return }
    router.push(`/entry/${race.id}`)
  }

  async function sendChat() {
    if (!chatInput.trim() || !isLoggedIn) return
    const pb = getPocketBase()
    const text = chatInput.trim()
    setChatInput('')
    try {
      await pb.collection('chat_messages').create({
        race_id: selectedRace?.id || 'kikoto',
        user_id: pb.authStore.record?.id,
        user_name: username || 'Vendég',
        text,
      })
    } catch (e) {
      const now = new Date()
      setChatMsgs(prev => [...prev, {
        id: Date.now().toString(), user: username || 'Vendég', text,
        time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      }])
    }
  }

  const [realWeather, setRealWeather] = useState<{temp:number,desc:string,wind:number,windDir:number,icon:string}|null>(null)

  useEffect(() => {
    if (!mounted) return
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=46.9&lon=18.05&appid=045a2be73e0c8aa4aa710a14a13d45d0&units=metric&lang=hu`)
      .then(r => r.json())
      .then(d => {
        setRealWeather({
          temp: Math.round(d.main?.temp || 0),
          desc: d.weather?.[0]?.description || '',
          wind: Math.round((d.wind?.speed || 0) * 1.944 * 10) / 10,
          windDir: d.wind?.deg || 0,
          icon: d.weather?.[0]?.icon || '',
        })
      })
      .catch(() => {})
  }, [mounted])

  const isActive = selectedRace?.status === 'active'
  const isStarted = isActive && selectedRace?.actual_start

  if (!mounted) return null

  function handleAuthSuccess(name: string) {
    setIsLoggedIn(true)
    setUsername(name)
    setAuthModal(null)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="min-w-0 flex-1">
        {authModal && (
          <AuthModal mode={authModal} onClose={() => setAuthModal(null)} onSuccess={handleAuthSuccess}/>
        )}

        {/* Fejléc */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground md:hidden">
                <Anchor className="size-5" strokeWidth={2} />
              </div>
              <div>
                <h1 className="font-heading text-lg font-black leading-none tracking-wide text-foreground">KIKÖTŐ</h1>
                <p className="label-caps mt-1 text-[8px] text-muted-foreground">Verseny-hub · Balaton</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(windSpeed > 0 || realWeather) && (
                <div className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 sm:flex">
                  <Wind className="size-3.5 text-muted-foreground" strokeWidth={1.75}/>
                  {windSpeed > 0 ? (
                    <>
                      <span className="font-heading text-sm font-semibold text-foreground">{windSpeed} kn</span>
                      <span className="text-xs text-muted-foreground">{dirLabel(windDir)} {windDir}°</span>
                      <span className="label-caps ml-1 text-[8px] text-secondary">verseny</span>
                    </>
                  ) : realWeather ? (
                    <>
                      <span className="font-heading text-sm font-semibold text-foreground">{realWeather.wind} kn</span>
                      <span className="text-xs text-muted-foreground">{dirLabel(realWeather.windDir)}</span>
                      <span className="text-xs text-muted-foreground">· {realWeather.temp}°C</span>
                    </>
                  ) : null}
                </div>
              )}
              {isLoggedIn ? (
                <>
                  <span className="label-caps rounded-md bg-secondary/15 px-2 py-1 text-[9px] text-secondary">{credits} kr</span>
                  <button onClick={() => canEnterDeck ? router.push('/dashboard') : undefined}
                    disabled={!canEnterDeck}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-heading text-xs font-semibold transition-colors ${canEnterDeck ? 'bg-foreground text-background hover:bg-secondary cursor-pointer' : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'}`}>
                    Fedélzet <ChevronRight className="size-3"/>
                  </button>
                  <button onClick={() => { getPocketBase().authStore.clear(); setIsLoggedIn(false); setUsername(''); setCredits(0) }}
                    className="rounded-md border border-border px-3 py-1.5 font-heading text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                    Kilépés
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setAuthModal("login")}
                    className="rounded-md border border-border px-3 py-1.5 font-heading text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                    Bejelentkezés
                  </button>
                  <button onClick={() => setAuthModal("register")}
                    className="rounded-md bg-foreground px-3 py-1.5 font-heading text-sm font-semibold text-background transition-colors hover:bg-secondary">
                    Regisztráció
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Verseny-választó fülek */}
          {races.length > 1 && (
            <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
              <div className="flex flex-wrap gap-1.5">
                {races.map(r => {
                  const live = r.status === 'active'
                  const sel = selectedRace?.id === r.id
                  return (
                    <button key={r.id} onClick={() => setSelectedRace(r)}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-heading text-xs font-semibold transition-all ${sel?'border-secondary bg-secondary/15 text-secondary':'border-border text-muted-foreground hover:text-foreground'}`}>
                      {live && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
                      {r.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </header>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {!selectedRace ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <Anchor className="mx-auto mb-3 size-10 text-muted-foreground"/>
              <p className="mb-1 font-heading text-lg font-semibold text-foreground">Nincs aktív verseny</p>
              <p className="text-sm text-muted-foreground">Hamarosan érkezik a következő kiírás!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* ADAPTÍV VERSENY-FEJ — countdown vagy élő futamidő */}
              <RaceHero
                race={selectedRace}
                isActive={!!isActive}
                isStarted={!!isStarted}
                elapsed={elapsed}
                countdown={countdown}
                joined={myRaces.includes(selectedRace.id)}
                onJoin={() => joinRace(selectedRace)}
                topStanding={standings[0]}
                canEnterDeck={canEnterDeck}
              />

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Térkép + állás */}
                <div className="space-y-5 lg:col-span-2">
                  <div className="relative isolate z-0 overflow-hidden rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                      <p className="font-heading text-sm font-semibold text-foreground">Pálya · élő pozíciók</p>
                      {isActive && (
                        <span className="label-caps flex items-center gap-1 text-[8px] text-primary">
                          <Radio className="size-3 animate-pulse" /> élő
                        </span>
                      )}
                    </div>
                    <div ref={mapRef} className="h-[420px] w-full"/>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" strokeWidth={1.75}/>
                      <p className="font-heading text-sm font-semibold text-foreground">Versenyállás</p>
                      {isActive && <span className="label-caps ml-auto flex items-center gap-1 text-[8px] text-primary"><Radio className="size-3 animate-pulse"/>élő</span>}
                    </div>
                    {standings.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">
                        {isActive ? 'Adatok betöltése...' : 'A verseny indulása után jelenik meg az állás.'}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {standings.map(s => {
                          const medal = s.pos <= 3
                          const medalColor = s.pos === 1 ? 'text-[var(--gold)]' : s.pos === 2 ? 'text-muted-foreground' : 'text-primary'
                          return (
                            <div key={s.playerId} className="flex items-center gap-3 rounded-md px-2 py-2 odd:bg-muted/40">
                              <span className={`flex w-6 justify-center font-heading text-base font-black ${medal ? medalColor : 'text-muted-foreground'}`}>
                                {medal ? <Medal className="size-4" /> : s.pos}
                              </span>
                              <Ship className="size-3.5 shrink-0 text-secondary" strokeWidth={1.75} />
                              <span className="flex-1 truncate font-heading text-sm font-semibold text-foreground">{s.name || 'Versenyző'}</span>
                              <span className="text-xs text-muted-foreground">CP {s.cp}</span>
                              <span className="font-heading text-sm font-semibold text-secondary">{s.speed} kn</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Info, nyeremények, chat */}
                <div className="space-y-5">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Flag className="size-4 text-accent" strokeWidth={2}/>
                      <h2 className="font-heading text-base font-bold text-foreground">{selectedRace.name}</h2>
                    </div>
                    {selectedRace.description && <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{selectedRace.description}</p>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {selectedRace.scheduled_start && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3"/>{new Date(selectedRace.scheduled_start).toLocaleString('hu-HU')}
                        </span>
                      )}
                      {selectedRace.entry_fee ? (
                        <span className="font-semibold text-secondary">{selectedRace.entry_fee} kr nevezés</span>
                      ) : <span className="text-secondary">Ingyenes</span>}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Trophy className="size-4 text-muted-foreground" strokeWidth={1.75}/>
                      <p className="font-heading text-sm font-semibold text-foreground">Nyeremények</p>
                    </div>
                    {[{pos:1,label:'1. hely',kr:500,xp:1000,c:'text-[var(--gold)]'},{pos:2,label:'2. hely',kr:300,xp:600,c:'text-muted-foreground'},{pos:3,label:'3. hely',kr:150,xp:300,c:'text-primary'}].map(({pos,label,kr,xp,c}) => (
                      <div key={pos} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
                        <span className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
                          <Medal className={`size-3.5 ${c}`} />{label}
                        </span>
                        <div className="flex gap-3 text-xs">
                          <span className="font-semibold text-secondary">{kr} kr</span>
                          <span className="text-muted-foreground">{xp} XP</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex h-[320px] flex-col rounded-lg border border-border bg-card">
                    <div className="shrink-0 border-b border-border px-4 py-3">
                      <p className="font-heading text-sm font-semibold text-foreground">Kikötői chat</p>
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
                      {chatMsgs.map(msg => (
                        <div key={msg.id} className="text-xs leading-relaxed">
                          {msg.isSystem ? (
                            <span className="label-caps text-[9px] text-muted-foreground">{msg.text}</span>
                          ) : (
                            <>
                              <span className="mr-1 font-semibold text-secondary">{msg.user}</span>
                              {msg.time && <span className="mr-1 text-[9px] text-muted-foreground">{msg.time}</span>}
                              <span className="text-foreground">{msg.text}</span>
                            </>
                          )}
                        </div>
                      ))}
                      <div ref={chatEndRef}/>
                    </div>
                    <div className="flex shrink-0 gap-2 border-t border-border p-3">
                      <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key==='Enter' && sendChat()}
                        placeholder={isLoggedIn ? "Üzenet..." : "Jelentkezz be a chathez"}
                        disabled={!isLoggedIn}
                        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-secondary disabled:opacity-50"/>
                      <button onClick={sendChat} disabled={!isLoggedIn}
                        className="rounded-md bg-foreground p-1.5 text-background transition-colors hover:bg-secondary disabled:opacity-50">
                        <Send className="size-3.5"/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---- Adaptív verseny-fej: countdown (rajt előtt) vagy élő futamidő ---- */
function RaceHero({
  race, isActive, isStarted, elapsed, countdown, joined, onJoin, topStanding, canEnterDeck,
}: {
  race: Race; isActive: boolean; isStarted: boolean; elapsed: string
  countdown: { d: number; h: number; m: number; s: number; done: boolean }
  joined: boolean; onJoin: () => void; topStanding?: any; canEnterDeck: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-foreground text-background">
      <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/90 to-secondary/30" />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            {isActive ? (
              <span className="label-caps flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 text-[9px] text-primary-foreground">
                <Radio className="size-3 animate-pulse" /> Verseny folyamatban
              </span>
            ) : (
              <span className="label-caps rounded-md bg-background/15 px-2 py-1 text-[9px] text-background">
                Közelgő futam
              </span>
            )}
          </div>
          <h2 className="font-heading text-2xl font-black leading-tight text-balance sm:text-3xl">{race.name}</h2>
          {isActive ? (
            topStanding ? (
              <p className="mt-1 text-sm text-background/70">
                Élen: <span className="font-semibold text-background">{topStanding.name}</span> · {topStanding.speed} kn
              </p>
            ) : (
              <p className="mt-1 text-sm text-background/70">A mezőny vízen van — kövesd a térképen!</p>
            )
          ) : (
            <p className="mt-1 text-sm text-background/70">{race.description || 'Készülj fel a rajtra.'}</p>
          )}
        </div>

        {/* Időkijelző — adaptív */}
        <div className="shrink-0">
          {isStarted ? (
            <div className="rounded-md border border-primary/40 bg-primary/15 px-5 py-3 text-center">
              <p className="label-caps mb-1 text-[8px] text-background/70">Eltelt idő</p>
              <p className="font-heading text-3xl font-black tabular-nums tracking-wider text-background">{elapsed}</p>
            </div>
          ) : !countdown.done ? (
            <div className="rounded-md border border-background/15 bg-background/5 px-4 py-3">
              <p className="label-caps mb-2 text-center text-[8px] text-background/70">Rajtig hátra</p>
              <div className="flex gap-3">
                {[['NAP',countdown.d],['ÓRA',countdown.h],['PERC',countdown.m],['MP',countdown.s]].map(([l,v]) => (
                  <div key={String(l)} className="text-center">
                    <div className="font-heading text-2xl font-black leading-none tabular-nums text-background">{String(v).padStart(2,'0')}</div>
                    <div className="label-caps mt-1 text-[7px] text-background/60">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <button onClick={joined && canEnterDeck ? onJoin : (!joined ? onJoin : undefined)}
            disabled={joined && !canEnterDeck}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 font-heading text-sm font-semibold transition-colors ${joined && canEnterDeck ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : joined && !canEnterDeck ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
            {joined ? <><Ship className="size-4"/>Fedélzetre</> : <><Flag className="size-4"/>Nevezés a futamra</>}
          </button>
        </div>
      </div>
    </div>
  )
}
