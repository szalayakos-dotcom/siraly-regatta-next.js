'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getPocketBase } from '@/lib/pocketbase'
import { Flag, Ship, Anchor, Trophy, ChevronRight, ChevronLeft, Check, Lock } from 'lucide-react'

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090'

interface Race {
  id: string; name: string; status: string
  scheduled_start?: string; entry_fee?: number
  description?: string
  prize_1st?: number; prize_2nd?: number; prize_3rd?: number
  prize_xp_1st?: number; prize_xp_2nd?: number; prize_xp_3rd?: number
}

interface Boat {
  id: string; name: string; class_id: string; type_name?: string
  sail_number?: string; description?: string
  speed_rating?: number; turn_rating?: number
  image?: string; collectionId?: string
  expand?: { class_id?: { id: string; name: string } }
}

interface Captain {
  id: string; name: string; description?: string
  image?: string; collectionId?: string
  sail_rating: number; weather_rating: number; helm_rating: number
  rental_credits: number; gadget?: string; available: boolean
}

const BOAT_CLASSES = [
  { value: 'ys1', label: 'Ys.I',   classId: '9g4us1y1ye7afym', desc: 'Nehéz osztály', sub: '1200–1800 kg', polar: 'Lassabb, stabil' },
  { value: 'ys2', label: 'Ys.II',  classId: '40t0bopld7pwwo4', desc: 'Közép osztály', sub: '800–1200 kg',  polar: 'Kiegyensúlyozott' },
  { value: 'ys3', label: 'Ys.III', classId: 'lgtakoks0p1jnvd', desc: 'Könnyű osztály', sub: '400–800 kg',  polar: 'Gyors, érzékeny' },
]

const GADGET_LABELS: Record<string, { emoji: string; desc: string }> = {
  tech_guru:     { emoji: '🤖', desc: 'Autopilot ingyen' },
  alkudozo:      { emoji: '💰', desc: 'Nevezési díj -40%' },
  rajtmester:    { emoji: '⏱', desc: '+30mp rajtelőny' },
  viharlovas:    { emoji: '🛡', desc: 'Viharban nincs lassulás' },
  szelLovas:     { emoji: '💨', desc: 'Hátszélben +15%' },
  kotelmagus:    { emoji: '🪢', desc: 'Vitorlacsere 0 perc' },
  spinn_mester:  { emoji: '⛵', desc: 'Spinnaker auto 100%' },
  driftvadasz:   { emoji: '🌊', desc: 'Drift -50%' },
  szerelo:       { emoji: '🔧', desc: '1x penalty törlés' },
  bajnok:        { emoji: '🏆', desc: 'Pont x1.5 top 3-ban' },
  trim_mester:   { emoji: '⭐', desc: 'Trim gomb ingyen' },
  hajnali_madar: { emoji: '🌅', desc: 'Versenyidő -5%' },
  kem:           { emoji: '👁', desc: 'Látja mások trimjét' },
  algamester:    { emoji: '🌿', desc: '+10% parti szakaszon' },
}

function RatingBar({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          width: '18px', height: '4px', borderRadius: '2px',
          background: i < Math.round(value / 20) ? 'var(--secondary)' : 'var(--border)',
        }}/>
      ))}
    </div>
  )
}

function StepIndicator({ step }: { step: number }) {
  const steps = ['Hajó', 'Kapitány', 'Összesítő']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px' }}>
      {steps.map((label, i) => {
        const idx = i + 1
        const active = step === idx
        const done = step > idx
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? '1' : 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--secondary)' : active ? 'var(--foreground)' : 'var(--border)',
                color: done || active ? 'var(--background)' : 'var(--muted-foreground)',
                fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-heading)',
                transition: 'all 0.2s',
              }}>
                {done ? <Check size={13}/> : idx}
              </div>
              <span style={{
                fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase',
                fontFamily: 'var(--font-heading)', fontWeight: 600,
                color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: '1px', background: done ? 'var(--secondary)' : 'var(--border)', margin: '0 8px', marginBottom: '18px' }}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function EntryPage() {
  const params = useParams()
  const router = useRouter()
  const raceId = params.raceId as string

  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState(1) // 1: hajó, 2: kapitány, 3: összesítő
  const [race, setRace] = useState<Race | null>(null)
  const [credits, setCredits] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Hajó step
  const [boatMode, setBoatMode] = useState<'own' | 'rent'>('rent')
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [boats, setBoats] = useState<Boat[]>([])
  const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null)
  const [boatsLoading, setBoatsLoading] = useState(false)

  // Kapitány step
  const [captains, setCaptains] = useState<Captain[]>([])
  const [selectedCaptain, setSelectedCaptain] = useState<Captain | null>(null)
  const [captainsLoading, setCaptainsLoading] = useState(false)
  const [skipCaptain, setSkipCaptain] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()
    async function load() {
      try {
        const r = await pb.collection('races').getOne(raceId)
        setRace(r as Race)
        if (pb.authStore.isValid) {
          setIsLoggedIn(true)
          try {
            const profile = await pb.collection('player_profiles').getFirstListItem(`user_id='${pb.authStore.record?.id}'`)
            setCredits(profile.credits || 0)
          } catch {}
        }
      } catch (e) {
        setError('A verseny nem található.')
      }
      setLoading(false)
    }
    load()
  }, [mounted, raceId])

  // Hajók betöltése - összes hajó expand-dal, kliens oldalon szűrünk osztályra
  const [allBoats, setAllBoats] = useState<Boat[]>([])
  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()
    pb.collection('boats').getFullList({
      expand: 'class_id',
      filter: 'available=true',
      sort: 'name',
    }).then(res => {
      setAllBoats(res as Boat[])
    }).catch(() => {})
  }, [mounted])

  useEffect(() => {
    if (!selectedClass) return
    setSelectedBoat(null)
    setBoatsLoading(true)
    const bc = BOAT_CLASSES.find(b => b.value === selectedClass)
    const filtered = allBoats.filter(boat => boat.class_id === bc?.classId)
    setBoats(filtered)
    setBoatsLoading(false)
  }, [selectedClass, allBoats])

  // Kapitányok betöltése
  useEffect(() => {
    if (step !== 2) return
    setCaptainsLoading(true)
    const pb = getPocketBase()
    pb.collection('captains').getFullList({
      filter: 'available=true',
      sort: 'rental_credits',
    }).then(res => {
      setCaptains(res as Captain[])
      setCaptainsLoading(false)
    }).catch(() => setCaptainsLoading(false))
  }, [step])

  function boatImageUrl(boat: Boat) {
    if (!boat.image) return null
    return `${PB_URL}/api/files/${boat.collectionId || 'boats'}/${boat.id}/${boat.image}`
  }

  function captainImageUrl(c: Captain) {
    if (!c.image) return null
    return `${PB_URL}/api/files/${c.collectionId || 'captains'}/${c.id}/${c.image}`
  }

  const captainCost = selectedCaptain ? selectedCaptain.rental_credits : 0
  const entryCost = race?.entry_fee || 0
  const totalCost = entryCost + captainCost
  const remaining = credits - totalCost
  const canAfford = remaining >= 0

  async function handleSubmit() {
    if (!race || !selectedBoat) return
    if (!isLoggedIn) { setError('Jelentkezz be a nevezéshez!'); return }
    setSubmitting(true); setError('')
    const pb = getPocketBase()
    const userId = pb.authStore.record?.id
    try {
      // Ellenőrzés: már nevezett-e
      const existing = await pb.collection('player_races').getFullList({
        filter: `race_id='${raceId}' && player_id='${userId}'`
      })
      if (existing.length > 0) {
        router.push('/dashboard'); return
      }
      // player_races létrehozása
      await pb.collection('player_races').create({
        race_id: raceId,
        player_id: userId,
        boat_id: selectedBoat.id,
        captain_id: selectedCaptain?.id || null,
        status: 'registered',
        credits: credits,
      })
      // Kredit levonás
      if (totalCost > 0) {
        try {
          const profile = await pb.collection('player_profiles').getFirstListItem(`user_id='${userId}'`)
          await pb.collection('player_profiles').update(profile.id, { credits: credits - totalCost })
        } catch {}
      }
      setSuccess(true)
      setTimeout(() => router.push('/kikoto'), 2000)
    } catch (e: any) {
      setError(e?.message || 'Hiba a nevezés során.')
    }
    setSubmitting(false)
  }

  if (!mounted || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--muted-foreground)', letterSpacing: '2px', fontSize: '12px' }}>BETÖLTÉS...</p>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⛵</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: 'var(--foreground)', marginBottom: '8px' }}>NEVEZÉS SIKERES!</h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-foreground)' }}>Visszairányítás a kikötőbe...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Fejléc */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.push('/kikoto')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-heading)', letterSpacing: '1px' }}>
          <ChevronLeft size={14}/> KIKÖTŐ
        </button>
        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flag size={14} color="var(--accent)"/>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', color: 'var(--foreground)' }}>
            {race?.name || 'Nevezés'}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {race?.scheduled_start && (
            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>
              {new Date(race.scheduled_start).toLocaleString('hu-HU')}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--secondary)' }}>
            {credits} kr
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px' }}>
        <StepIndicator step={step}/>

        {/* === STEP 1: HAJÓ === */}
        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 900, color: 'var(--foreground)', marginBottom: '20px', letterSpacing: '1px' }}>
              HAJÓ KIVÁLASZTÁSA
            </h2>

            {/* Saját hajó / Bérlés toggle */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
              {/* Saját hajó - inaktív */}
              <div style={{
                flex: 1, padding: '16px', borderRadius: '4px', border: '1px solid var(--border)',
                background: 'var(--muted)', opacity: 0.5, cursor: 'not-allowed', position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Anchor size={16} color="var(--muted-foreground)"/>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', color: 'var(--muted-foreground)' }}>Saját hajó</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase',
                    background: 'var(--border)', color: 'var(--muted-foreground)', padding: '2px 6px', borderRadius: '3px',
                    fontFamily: 'var(--font-heading)', fontWeight: 600,
                  }}>Hamarosan</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>
                  Saját hajó regisztrálása és versenyzés
                </p>
                <Lock size={12} color="var(--muted-foreground)" style={{ position: 'absolute', bottom: '12px', right: '12px' }}/>
              </div>

              {/* Hajó bérlése - aktív */}
              <div onClick={() => setBoatMode('rent')} style={{
                flex: 1, padding: '16px', borderRadius: '4px', cursor: 'pointer',
                border: `2px solid ${boatMode === 'rent' ? 'var(--foreground)' : 'var(--border)'}`,
                background: boatMode === 'rent' ? 'var(--card)' : 'var(--background)',
                transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Ship size={16} color="var(--secondary)"/>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', color: 'var(--foreground)' }}>Hajó bérlése</span>
                  {boatMode === 'rent' && <Check size={14} color="var(--secondary)" style={{ marginLeft: 'auto' }}/>}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>
                  Válassz a flottából, indulj el azonnal
                </p>
              </div>
            </div>

            {/* Osztály választás */}
            <p style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--muted-foreground)', marginBottom: '10px' }}>
              Hajóosztály
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px' }}>
              {BOAT_CLASSES.map(bc => (
                <div key={bc.value} onClick={() => setSelectedClass(bc.value)} style={{
                  padding: '14px', borderRadius: '4px', cursor: 'pointer',
                  border: `2px solid ${selectedClass === bc.value ? 'var(--foreground)' : 'var(--border)'}`,
                  background: selectedClass === bc.value ? 'var(--card)' : 'var(--background)',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '20px', color: 'var(--foreground)', marginBottom: '2px' }}>{bc.label}</div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-sans)', color: 'var(--foreground)', marginBottom: '2px' }}>{bc.desc}</div>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-sans)', color: 'var(--muted-foreground)', marginBottom: '4px' }}>{bc.sub}</div>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-sans)', color: 'var(--secondary)' }}>{bc.polar}</div>
                  {selectedClass === bc.value && <Check size={12} color="var(--secondary)" style={{ marginTop: '6px' }}/>}
                </div>
              ))}
            </div>

            {/* Hajó kártyák */}
            {selectedClass && (
              <>
                <p style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--muted-foreground)', marginBottom: '10px' }}>
                  Válassz hajót
                </p>
                {boatsLoading ? (
                  <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', padding: '20px 0' }}>Betöltés...</p>
                ) : boats.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', padding: '20px 0' }}>Nincsenek elérhető hajók ebben az osztályban.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                    {boats.map(boat => {
                      const imgUrl = boatImageUrl(boat)
                      const selected = selectedBoat?.id === boat.id
                      return (
                        <div key={boat.id} onClick={() => setSelectedBoat(boat)} style={{
                          borderRadius: '4px', overflow: 'hidden', cursor: 'pointer',
                          border: `2px solid ${selected ? 'var(--foreground)' : 'var(--border)'}`,
                          background: 'var(--card)', transition: 'all 0.15s',
                          position: 'relative',
                        }}>
                          {/* Kép */}
                          <div style={{ width: '100%', aspectRatio: '3/4', background: 'var(--muted)', overflow: 'hidden' }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt={boat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Ship size={32} color="var(--muted-foreground)"/>
                              </div>
                            )}
                          </div>
                          {/* Infó */}
                          <div style={{ padding: '8px 10px' }}>
                            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '13px', color: 'var(--foreground)', marginBottom: '2px' }}>{boat.name}</div>
                            {boat.sail_number && <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>#{boat.sail_number}</div>}
                          </div>
                          {selected && (
                            <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--foreground)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={11} color="var(--background)"/>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* Tovább gomb */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedBoat}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: selectedBoat ? 'var(--foreground)' : 'var(--border)',
                  color: selectedBoat ? 'var(--background)' : 'var(--muted-foreground)',
                  border: 'none', borderRadius: '4px', padding: '10px 24px',
                  fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '13px', letterSpacing: '1px',
                  cursor: selectedBoat ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                }}
              >
                TOVÁBB <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* === STEP 2: KAPITÁNY === */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 900, color: 'var(--foreground)', marginBottom: '8px', letterSpacing: '1px' }}>
              KAPITÁNY VÁLASZTÁSA
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', marginBottom: '20px' }}>
              A kapitány befolyásolja a trim hatékonyságot, driftet és különleges gadgetjével egyedi előnyt biztosít.
            </p>

            {/* Kapitány nélkül opció */}
            <div onClick={() => { setSelectedCaptain(null); setSkipCaptain(true) }} style={{
              padding: '12px 16px', borderRadius: '4px', marginBottom: '16px', cursor: 'pointer',
              border: `2px solid ${skipCaptain && !selectedCaptain ? 'var(--foreground)' : 'var(--border)'}`,
              background: 'var(--background)', display: 'flex', alignItems: 'center', gap: '10px',
              transition: 'all 0.15s',
            }}>
              <Anchor size={14} color="var(--muted-foreground)"/>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '13px', color: 'var(--foreground)' }}>Kapitány nélkül</div>
                <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>Ingyen, de nincs skill bónusz</div>
              </div>
              {skipCaptain && !selectedCaptain && <Check size={14} color="var(--secondary)" style={{ marginLeft: 'auto' }}/>}
            </div>

            {captainsLoading ? (
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)', padding: '20px 0' }}>Betöltés...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                {captains.map(cap => {
                  const imgUrl = captainImageUrl(cap)
                  const selected = selectedCaptain?.id === cap.id
                  const gadget = cap.gadget ? GADGET_LABELS[cap.gadget] : null
                  return (
                    <div key={cap.id} onClick={() => { setSelectedCaptain(cap); setSkipCaptain(false) }} style={{
                      borderRadius: '4px', overflow: 'hidden', cursor: 'pointer',
                      border: `2px solid ${selected ? 'var(--foreground)' : 'var(--border)'}`,
                      background: 'var(--card)', transition: 'all 0.15s', position: 'relative',
                    }}>
                      {/* Kép */}
                      <div style={{ width: '100%', aspectRatio: '3/4', background: 'var(--muted)', overflow: 'hidden' }}>
                        {imgUrl ? (
                          <img src={imgUrl} alt={cap.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Anchor size={32} color="var(--muted-foreground)"/>
                          </div>
                        )}
                      </div>
                      {/* Infó */}
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '13px', color: 'var(--foreground)', marginBottom: '4px' }}>{cap.name}</div>
                        {/* Ratingek */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '8px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-heading)', letterSpacing: '1px' }}>VITORLA</span>
                            <RatingBar value={cap.sail_rating}/>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '8px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-heading)', letterSpacing: '1px' }}>IDŐJÁRÁS</span>
                            <RatingBar value={cap.weather_rating}/>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '8px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-heading)', letterSpacing: '1px' }}>KORMÁNY</span>
                            <RatingBar value={cap.helm_rating}/>
                          </div>
                        </div>
                        {gadget && (
                          <div style={{ fontSize: '9px', color: 'var(--secondary)', fontFamily: 'var(--font-sans)', marginBottom: '4px' }}>
                            {gadget.emoji} {gadget.desc}
                          </div>
                        )}
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '12px', color: 'var(--secondary)' }}>
                          {cap.rental_credits} kr
                        </div>
                      </div>
                      {selected && (
                        <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--foreground)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={11} color="var(--background)"/>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <button onClick={() => setStep(1)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: '1px solid var(--border)', borderRadius: '4px',
                padding: '10px 20px', fontFamily: 'var(--font-heading)', fontWeight: 600,
                fontSize: '12px', letterSpacing: '1px', color: 'var(--muted-foreground)', cursor: 'pointer',
              }}>
                <ChevronLeft size={13}/> VISSZA
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedCaptain && !skipCaptain}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: (selectedCaptain || skipCaptain) ? 'var(--foreground)' : 'var(--border)',
                  color: (selectedCaptain || skipCaptain) ? 'var(--background)' : 'var(--muted-foreground)',
                  border: 'none', borderRadius: '4px', padding: '10px 24px',
                  fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '13px', letterSpacing: '1px',
                  cursor: (selectedCaptain || skipCaptain) ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                }}
              >
                TOVÁBB <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* === STEP 3: ÖSSZESÍTŐ === */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 900, color: 'var(--foreground)', marginBottom: '20px', letterSpacing: '1px' }}>
              NEVEZÉS ÖSSZESÍTŐ
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              {/* Verseny */}
              <div style={{ padding: '16px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--card)' }}>
                <p style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Verseny</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Flag size={13} color="var(--accent)"/>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', color: 'var(--foreground)' }}>{race?.name}</span>
                </div>
                {race?.scheduled_start && (
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>
                    {new Date(race.scheduled_start).toLocaleString('hu-HU')}
                  </p>
                )}
              </div>

              {/* Hajó */}
              <div style={{ padding: '16px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--card)' }}>
                <p style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Hajó</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Ship size={13} color="var(--secondary)"/>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', color: 'var(--foreground)' }}>{selectedBoat?.name}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>
                  {selectedBoat?.expand?.class_id?.name || BOAT_CLASSES.find(bc => bc.value === selectedClass)?.label} osztály
                  {selectedBoat?.sail_number && ` · #${selectedBoat.sail_number}`}
                </p>
              </div>

              {/* Kapitány */}
              <div style={{ padding: '16px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--card)' }}>
                <p style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Kapitány</p>
                {selectedCaptain ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Anchor size={13} color="var(--secondary)"/>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', color: 'var(--foreground)' }}>{selectedCaptain.name}</span>
                    </div>
                    {selectedCaptain.gadget && GADGET_LABELS[selectedCaptain.gadget] && (
                      <p style={{ fontSize: '11px', color: 'var(--secondary)', fontFamily: 'var(--font-sans)' }}>
                        {GADGET_LABELS[selectedCaptain.gadget].emoji} {GADGET_LABELS[selectedCaptain.gadget].desc}
                      </p>
                    )}
                  </>
                ) : (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-foreground)' }}>Kapitány nélkül</span>
                )}
              </div>

              {/* Nyeremények */}
              <div style={{ padding: '16px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--card)' }}>
                <p style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Nyeremények</p>
                {[
                  { pos: '🥇', kr: race?.prize_1st ?? 500, xp: race?.prize_xp_1st ?? 1000 },
                  { pos: '🥈', kr: race?.prize_2nd ?? 300, xp: race?.prize_xp_2nd ?? 600 },
                  { pos: '🥉', kr: race?.prize_3rd ?? 150, xp: race?.prize_xp_3rd ?? 300 },
                ].map(({ pos, kr, xp }) => (
                  <div key={pos} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12px' }}>{pos}</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', color: 'var(--secondary)', fontWeight: 700 }}>{kr} kr</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-foreground)' }}>{xp} XP</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kredit összesítő */}
            <div style={{ padding: '20px', borderRadius: '4px', border: `1px solid ${canAfford ? 'var(--border)' : 'var(--destructive)'}`, background: 'var(--card)', marginBottom: '20px' }}>
              <p style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--muted-foreground)', marginBottom: '12px' }}>Kredit összesítő</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-sans)', color: 'var(--foreground)' }}>
                  <span>Egyenleg</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{credits} kr</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-sans)', color: 'var(--muted-foreground)' }}>
                  <span>Nevezési díj</span>
                  <span>− {entryCost} kr</span>
                </div>
                {captainCost > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-sans)', color: 'var(--muted-foreground)' }}>
                    <span>Kapitány bérleti díj</span>
                    <span>− {captainCost} kr</span>
                  </div>
                )}
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }}/>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                  <span style={{ color: 'var(--foreground)' }}>Maradék egyenleg</span>
                  <span style={{ color: canAfford ? 'var(--secondary)' : 'var(--destructive)' }}>{remaining} kr</span>
                </div>
              </div>
              {!canAfford && (
                <p style={{ marginTop: '10px', fontSize: '11px', color: 'var(--destructive)', fontFamily: 'var(--font-sans)' }}>
                  Nincs elég kredited a nevezéshez.
                </p>
              )}
            </div>

            {error && (
              <p style={{ fontSize: '12px', color: 'var(--destructive)', fontFamily: 'var(--font-sans)', marginBottom: '12px' }}>{error}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(2)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: '1px solid var(--border)', borderRadius: '4px',
                padding: '10px 20px', fontFamily: 'var(--font-heading)', fontWeight: 600,
                fontSize: '12px', letterSpacing: '1px', color: 'var(--muted-foreground)', cursor: 'pointer',
              }}>
                <ChevronLeft size={13}/> VISSZA
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !canAfford || !isLoggedIn}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: canAfford && isLoggedIn ? 'var(--foreground)' : 'var(--border)',
                  color: canAfford && isLoggedIn ? 'var(--background)' : 'var(--muted-foreground)',
                  border: 'none', borderRadius: '4px', padding: '12px 32px',
                  fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', letterSpacing: '1px',
                  cursor: canAfford && isLoggedIn && !submitting ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                }}
              >
                {submitting ? 'FELDOLGOZÁS...' : <>⛵ NEVEZÉS MEGERŐSÍTÉSE</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
