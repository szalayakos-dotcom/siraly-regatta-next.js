'use client'

import { Sidebar } from '@/components/sidebar'

import { useEffect, useState, useRef } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { useRouter } from 'next/navigation'
import { Flag, Ship, Anchor, Trophy, Clock, Calendar, Wind, Users, Send, ChevronRight } from 'lucide-react'
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
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(26,42,58,0.85)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'6px', padding:'28px', width:'320px', maxWidth:'90vw' }}
        onClick={e => e.stopPropagation()}>
        <h2 className="font-heading text-lg font-bold text-foreground mb-4">
          {mode === 'login' ? 'Bejelentkezés' : 'Regisztráció'}
        </h2>
        <div className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="label-caps text-[9px] text-muted-foreground block mb-1">Megjelenített név</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Kapitány neve"
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
            </div>
          )}
          <div>
            <label className="label-caps text-[9px] text-muted-foreground block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
          </div>
          <div>
            <label className="label-caps text-[9px] text-muted-foreground block mb-1">Jelszó</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <button onClick={submit} disabled={loading}
            className="w-full rounded-sm bg-foreground py-2 font-heading text-sm font-semibold text-background hover:bg-secondary transition-colors disabled:opacity-50">
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
          { id: 'sys', user: 'Rendszer', text: 'Üdv a kikötőben! ⚓', time: '', isSystem: true },
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
        }
      } catch (e) {}
      try {
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${selectedRace.id}"`,
        })
        const sorted = positions.sort((a: any, b: any) =>
          (b.current_cp_index||0)-(a.current_cp_index||0) || (b.current_speed_kmh||0)-(a.current_speed_kmh||0)
        )
        // Nevek betöltése
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
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { opacity: 0.85 }).addTo(map)
      mapInstanceRef.current = map
      setTimeout(() => map.invalidateSize(), 300)
      if (selectedRace.course_id) {
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
          // Nevek és hajó adatok betöltése tooltiphez
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
                <div style="font-weight:700;font-size:13px;margin-bottom:4px">${isMine ? '⛵ Te' : '⛵ ' + info.name}</div>
                <div style="font-size:11px;color:#666">${info.boatName} · ${info.boatClass}</div>
                <div style="font-size:11px;color:#666">${info.boatType}</div>
                <div style="font-size:11px;margin-top:4px">
                  <span style="color:#c42b1c;font-weight:700">#${info.pos}</span>
                  <span style="color:#666;margin-left:8px">${speedKn} kn</span>
                  <span style="color:#666;margin-left:8px">CP ${pos.cp_index || 0}</span>
                </div>
              </div>`
            const icon = L.divIcon({
              html: `<div style="width:${sz}px;height:${sz}px;background:${isMine?'#c42b1c':'#2a6a7a'};border:2px solid ${isMine?'#c8a030':'rgba(255,255,255,0.5)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${isMine?16:12}px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">⛵</div>`,
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
    if (myRaces.includes(race.id)) { router.push('/dashboard'); return }
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
      // fallback: lokálisan adjuk hozzá
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
    // Balaton koordináta: Siófok
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=46.9&lon=18.05&appid=045a2be73e0c8aa4aa710a14a13d45d0&units=metric&lang=hu`)
      .then(r => r.json())
      .then(d => {
        setRealWeather({
          temp: Math.round(d.main?.temp || 0),
          desc: d.weather?.[0]?.description || '',
          wind: Math.round((d.wind?.speed || 0) * 1.944 * 10) / 10, // m/s -> kn
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
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
      {authModal && (
        <AuthModal mode={authModal} onClose={() => setAuthModal(null)} onSuccess={handleAuthSuccess}/>
      )}
      {/* Fejléc */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-heading text-xl font-black text-foreground tracking-wide">SIRÁLY REGATTA</h1>
              <p className="label-caps text-[8px] text-muted-foreground">KIKÖTŐ</p>
            </div>
            {(windSpeed > 0 || realWeather) && (
              <div className="flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-1.5">
                <Wind className="size-3.5 text-muted-foreground" strokeWidth={1.75}/>
                {windSpeed > 0 ? (
                  <>
                    <span className="font-heading text-sm font-semibold">{windSpeed} kn</span>
                    <span className="text-xs text-muted-foreground">{dirLabel(windDir)} {windDir}°</span>
                    <span className="label-caps text-[8px] text-secondary ml-1">verseny</span>
                  </>
                ) : realWeather ? (
                  <>
                    <span className="font-heading text-sm font-semibold">{realWeather.wind} kn</span>
                    <span className="text-xs text-muted-foreground">{dirLabel(realWeather.windDir)}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{realWeather.temp}°C</span>
                    <span className="text-xs text-muted-foreground">{realWeather.desc}</span>
                  </>
                ) : null}
              </div>
            )}
            {races.length > 1 && (
              <div className="flex gap-1.5">
                {races.map(r => (
                  <button key={r.id} onClick={() => setSelectedRace(r)}
                    className={`rounded-sm border px-3 py-1.5 font-heading text-xs font-semibold transition-all ${selectedRace?.id===r.id?'border-secondary bg-secondary/15 text-secondary':'border-border text-muted-foreground'}`}>
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <span className="font-heading text-sm font-semibold text-foreground">{username}</span>
                <span className="label-caps text-[9px] px-2 py-1 rounded-sm bg-secondary/15 text-secondary">{credits} kr</span>
                <button onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-1.5 rounded-sm bg-foreground px-3 py-1.5 font-heading text-xs font-semibold text-background hover:bg-secondary transition-colors">
                  Fedélzet <ChevronRight className="size-3"/>
                </button>
                <button onClick={() => { getPocketBase().authStore.clear(); setIsLoggedIn(false); setUsername(''); setCredits(0) }}
                  className="rounded-sm border border-border px-3 py-1.5 font-heading text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  Kilépés
                </button>
              </>
            ) : (
              <>
              <button onClick={() => setAuthModal("login")}
                className="rounded-sm border border-border px-3 py-1.5 font-heading text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                Bejelentkezés
              </button>
              <button onClick={() => setAuthModal("register")}
                className="rounded-sm bg-foreground px-3 py-1.5 font-heading text-sm font-semibold text-background hover:bg-secondary transition-colors">
                Regisztráció
              </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {!selectedRace ? (
          <div className="rounded-sm border border-border bg-card p-12 text-center">
            <Anchor className="size-10 text-muted-foreground mx-auto mb-3"/>
            <p className="font-heading text-lg font-semibold text-foreground mb-1">Nincs aktív verseny</p>
            <p className="text-sm text-muted-foreground">Hamarosan érkezik a következő kiírás!</p>
          </div>
        ) : (
          <div>
            {/* Poszter banner */}
            {selectedRace.poster && (
              <div className="rounded-sm border border-border overflow-hidden mb-4" style={{ aspectRatio: '4/1' }}>
                <img
                  src={`http://127.0.0.1:8090/api/files/races/${selectedRace.id}/${selectedRace.poster}`}
                  alt={selectedRace.name}
                  style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* BAL OSZLOP */}
              <div className="space-y-4">
                {/* Verseny info */}
                <div className="rounded-sm border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Flag className="size-4 text-accent" strokeWidth={2}/>
                    <h2 className="font-heading text-base font-bold text-foreground">{selectedRace.name}</h2>
                    {isActive && <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-green-500/15 text-green-600 animate-pulse">● ÉLŐ</span>}
                  </div>
                  {selectedRace.description && <p className="text-xs text-muted-foreground mb-3">{selectedRace.description}</p>}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                    {selectedRace.scheduled_start && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3"/>{new Date(selectedRace.scheduled_start).toLocaleString('hu-HU')}
                      </span>
                    )}
                    {selectedRace.entry_fee ? (
                      <span className="text-secondary font-semibold">{selectedRace.entry_fee} kr</span>
                    ) : <span className="text-secondary">Ingyenes</span>}
                  </div>

                  {isStarted ? (
                    <div className="rounded-sm bg-green-500/10 border border-green-500/20 px-3 py-2 mb-3">
                      <p className="label-caps text-[8px] text-green-600 mb-1">Verseny folyamatban</p>
                      <p className="font-heading text-xl font-black text-foreground">{elapsed}</p>
                    </div>
                  ) : selectedRace.scheduled_start && !countdown.done ? (
                    <div className="rounded-sm border border-border bg-background/60 px-3 py-2 mb-3">
                      <p className="label-caps text-[8px] text-muted-foreground mb-2">Rajtig</p>
                      <div className="flex gap-3">
                        {[['NAP',countdown.d],['ÓRA',countdown.h],['PERC',countdown.m],['MP',countdown.s]].map(([l,v]) => (
                          <div key={String(l)} className="text-center">
                            <div className="font-heading text-xl font-black text-foreground leading-none">{String(v).padStart(2,'0')}</div>
                            <div className="label-caps text-[7px] text-muted-foreground mt-0.5">{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <button onClick={() => joinRace(selectedRace)}
                    className={`w-full flex items-center justify-center gap-2 rounded-sm px-4 py-2 font-heading text-sm font-semibold transition-colors ${myRaces.includes(selectedRace.id)?'bg-secondary text-secondary-foreground hover:bg-secondary/80':'bg-foreground text-background hover:bg-secondary'}`}>
                    {myRaces.includes(selectedRace.id) ? <><Ship className="size-4"/>Fedélzetre →</> : <><Flag className="size-4"/>Nevezés</>}
                  </button>
                </div>

                {/* Nyeremények */}
                <div className="rounded-sm border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="size-4 text-muted-foreground" strokeWidth={1.75}/>
                    <p className="font-heading text-sm font-semibold text-foreground">Nyeremények</p>
                  </div>
                  {[{pos:'🥇 1.',kr:500,xp:1000},{pos:'🥈 2.',kr:300,xp:600},{pos:'🥉 3.',kr:150,xp:300}].map(({pos,kr,xp}) => (
                    <div key={pos} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="font-heading text-sm font-semibold text-foreground">{pos} hely</span>
                      <div className="flex gap-3 text-xs">
                        <span className="text-secondary font-semibold">{kr} kr</span>
                        <span className="text-muted-foreground">{xp} XP</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat */}
                <div className="rounded-sm border border-border bg-card flex flex-col" style={{ height:'280px' }}>
                  <div className="px-4 py-3 border-b border-border shrink-0">
                    <p className="font-heading text-sm font-semibold text-foreground">Chat</p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
                    {chatMsgs.map(msg => (
                      <div key={msg.id} className="text-xs">
                        <span className="font-semibold text-secondary mr-1">{msg.user}</span>
                        {msg.time && <span className="text-muted-foreground text-[9px] mr-1">{msg.time}</span>}
                        <span className="text-foreground">{msg.text}</span>
                      </div>
                    ))}
                    <div ref={chatEndRef}/>
                  </div>
                  <div className="flex gap-2 p-3 border-t border-border shrink-0">
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && sendChat()}
                      placeholder={isLoggedIn ? "Üzenet..." : "Jelentkezz be a chathez"}
                      disabled={!isLoggedIn}
                      className="flex-1 rounded-sm border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-secondary disabled:opacity-50"/>
                    <button onClick={sendChat} disabled={!isLoggedIn}
                      className="rounded-sm bg-foreground p-1.5 text-background hover:bg-secondary disabled:opacity-50">
                      <Send className="size-3.5"/>
                    </button>
                  </div>
                </div>
              </div>

              {/* KÖZÉP + JOBB */}
              <div className="lg:col-span-2 space-y-4">
                {/* Térkép */}
                <div className="rounded-sm border border-border overflow-hidden" style={{ height:'400px', position:'sticky', top:'64px', zIndex:10 }}>
                  <div ref={mapRef} style={{ width:'100%', height:'100%' }}/>
                </div>

                {/* Versenyállás */}
                <div className="rounded-sm border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="size-4 text-muted-foreground" strokeWidth={1.75}/>
                    <p className="font-heading text-sm font-semibold text-foreground">Versenyállás</p>
                    {isActive && <span className="label-caps text-[8px] px-1.5 py-0.5 rounded-sm bg-green-500/15 text-green-600 ml-auto">● ÉLŐ</span>}
                  </div>
                  {standings.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {isActive ? 'Adatok betöltése...' : 'A verseny indulása után jelenik meg'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {standings.map(s => (
                        <div key={s.playerId} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                          <span className="font-heading text-base font-bold text-muted-foreground w-6 text-center">{s.pos}</span>
                          <span className="flex-1 font-heading text-sm font-semibold text-foreground">⛵ {s.name || 'Versenyző'}</span>
                          <span className="text-xs text-muted-foreground">CP {s.cp}</span>
                          <span className="font-heading text-sm font-semibold text-secondary">{s.speed} kn</span>
                        </div>
                      ))}
                    </div>
                  )}
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
