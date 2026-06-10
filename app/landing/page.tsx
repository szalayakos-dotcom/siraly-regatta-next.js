'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPocketBase } from '@/lib/pocketbase'

interface Race {
  id: string
  name: string
  scheduled_start: string
  status: string
  entry_fee_credits?: number
  description?: string
}

interface LeaderEntry {
  name: string
  xp: number
  total_races: number
  total_wins: number
}

function Countdown({ target }: { target: string }) {
  const [diff, setDiff] = useState('')
  useEffect(() => {
    function update() {
      const ms = new Date(target).getTime() - Date.now()
      if (ms <= 0) { setDiff('RAJT!'); return }
      const d = Math.floor(ms / 86400000)
      const h = Math.floor((ms % 86400000) / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      if (d > 0) setDiff(`${d} nap ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      else setDiff(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [target])
  return <span>{diff}</span>
}

export default function LandingPage() {
  const router = useRouter()
  const [nextRace, setNextRace] = useState<Race | null>(null)
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()

    async function load() {
      try {
        const races = await pb.collection('races').getFullList({
          filter: "status='published' || status='active'",
          sort: 'scheduled_start',
        })
        if (races.length) setNextRace(races[0] as Race)
      } catch {}

      try {
        const profiles = await pb.collection('player_profiles').getFullList({
          sort: '-xp', perPage: 5,
        })
        setLeaders(profiles.map((p: any) => ({
          name: p.display_name || 'Versenyző',
          xp: p.xp || 0,
          total_races: p.total_races || 0,
          total_wins: p.total_wins || 0,
        })))
      } catch {}
    }
    load()
  }, [mounted])

  if (!mounted) return null

  const steps = [
    { num: '01', icon: '⚓', title: 'Nevezz be', desc: 'Válassz versenyt, bérelj hajót és kapitányt. A nevezési díjat kreditből fizeted — ezeket versenyeken szerezheted.' },
    { num: '02', icon: '⛵', title: 'Rajtolj el', desc: 'A rajt előtt 5 perccel aktívvá válik a Start gomb. Időben lépj fedélzetre és indulj el — késés esetén a nevezés törlődik.' },
    { num: '03', icon: '🌊', title: 'Vitorlázz', desc: 'Állítsd be a vitorlákat és a trimet az aktuális szélhez. A fizikai motor valós polar adatok alapján számítja a sebességet — minden döntés számít.' },
    { num: '04', icon: '🏆', title: 'Célba érj', desc: 'Érintsd meg a bólyákat sorban és érj célba a lehető legjobb idővel. A top 3 extra kreditet és XP-t kap, minden bólyánál 10 kredit jár.' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>

      {/* Hero */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: '#d25c1c',
        minHeight: '420px',
        display: 'flex', alignItems: 'center',
      }}>
        {/* Poster háttér */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: '50%', opacity: 0.25,
          backgroundImage: 'url(/poster.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center left',
        }}/>

        <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto', padding: '64px 32px' }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '5px',
            color: 'rgba(253,249,224,0.7)', marginBottom: '16px', textTransform: 'uppercase',
          }}>
            ⚓ &nbsp; Balatoni Vitorlás Szimulátor
          </div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'clamp(48px, 6vw, 80px)',
            fontWeight: 900, color: '#fdf9e0', letterSpacing: '3px',
            lineHeight: 1, marginBottom: '24px',
          }}>
            SIRÁLY<br/>REGATTA
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '16px', lineHeight: 1.6,
            color: 'rgba(253,249,224,0.85)', maxWidth: '520px', marginBottom: '32px',
          }}>
            Egy böngészőből játszható, valós fizikán alapuló vitorlásverseny-szimulátor a Balatonon.
            Nevezz be, válassz hajót és kapitányt, állítsd be a vitorlákat — és versenyezz élőben
            más játékosok ellen.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/kikoto')} style={{
              background: '#fdf9e0', color: '#1a2535',
              border: 'none', borderRadius: '4px', padding: '14px 36px',
              fontFamily: 'var(--font-heading)', fontWeight: 700,
              fontSize: '14px', letterSpacing: '2px', cursor: 'pointer',
            }}>
              KIKÖTŐ →
            </button>
            <button onClick={() => router.push('/dashboard')} style={{
              background: 'transparent', color: '#fdf9e0',
              border: '1px solid rgba(253,249,224,0.5)', borderRadius: '4px',
              padding: '14px 36px',
              fontFamily: 'var(--font-heading)', fontWeight: 700,
              fontSize: '14px', letterSpacing: '2px', cursor: 'pointer',
            }}>
              FEDÉLZET
            </button>
          </div>
        </div>
      </div>

      {/* Következő verseny */}
      {nextRace && (
        <div style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)', padding: '20px 32px' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '3px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
                KÖVETKEZŐ VERSENY
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 900, color: 'var(--foreground)' }}>
                {nextRace.name}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                {new Date(nextRace.scheduled_start).toLocaleString('hu-HU')}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '3px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
                VISSZASZÁMLÁLÁS
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 900, color: '#d25c1c' }}>
                <Countdown target={nextRace.scheduled_start} />
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={() => router.push('/kikoto')} style={{
                background: '#d25c1c', color: '#fdf9e0',
                border: 'none', borderRadius: '4px', padding: '10px 28px',
                fontFamily: 'var(--font-heading)', fontWeight: 700,
                fontSize: '12px', letterSpacing: '2px', cursor: 'pointer',
              }}>
                NEVEZÉS →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hogyan működik */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '4px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
            HOGYAN MŰKÖDIK
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, color: 'var(--foreground)', letterSpacing: '1px' }}>
            A VERSENY MENETE
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {steps.map(step => (
            <div key={step.num} style={{
              background: 'var(--card)', borderRadius: '4px',
              border: '1px solid var(--border)', padding: '24px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: '12px', right: '16px',
                fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900,
                color: 'rgba(210,92,28,0.12)',
              }}>
                {step.num}
              </div>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>{step.icon}</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 900, color: 'var(--card-foreground)', marginBottom: '8px', letterSpacing: '1px' }}>
                {step.title}
              </h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Ranglista + Info */}
      <div style={{ background: 'var(--muted)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>

          {/* Ranglista */}
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '4px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
              RANGLISTA
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 900, color: 'var(--foreground)', marginBottom: '24px' }}>
              TOP VERSENYZŐK
            </h2>
            {leaders.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--muted-foreground)' }}>Még nincs elég adat.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {leaders.map((l, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'var(--card)', borderRadius: '4px',
                    border: '1px solid var(--border)', padding: '10px 16px',
                  }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 900, color: i === 0 ? '#c8a030' : i === 1 ? '#999' : i === 2 ? '#c87a30' : 'var(--muted-foreground)', width: '28px' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--card-foreground)' }}>{l.name}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-foreground)' }}>
                        {l.total_races} verseny · {l.total_wins} győzelem
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: '#d25c1c' }}>
                      {l.xp} XP
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '4px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
              A JÁTÉKRÓL
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 900, color: 'var(--foreground)', marginBottom: '24px' }}>
              AMIT TUDNOD KELL
            </h2>
            {[
              { icon: '🌊', title: 'Valós fizika', desc: 'Polar táblázatok alapján számított hajósebesség, drift, dőlés — minden vitorla és trim beállítás számít.' },
              { icon: '💨', title: 'Élő időjárás', desc: 'Minden versenyhez előre beállított széladatok szakaszonként — viharban ref, jó szélben optimalizálj.' },
              { icon: '🪙', title: 'Kredit rendszer', desc: 'Bólyánként 10 kredit, a top 3 extra nyereményt kap. Kreditből bérelsz hajót, kapitányt és vásárolsz felszerelést.' },
              { icon: '⚓', title: 'Kapitányok', desc: 'Minden kapitánynak egyedi gadgetje van — trim mester, viharlovas, rajtmester. Válassz okosan.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>{item.icon}</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '3px' }}>{item.title}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', lineHeight: 1.6, color: 'var(--muted-foreground)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{ textAlign: 'center', padding: '64px 32px', background: 'var(--background)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '4px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
          ⚓ &nbsp; SIRÁLY REGATTA
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 900, color: 'var(--foreground)', marginBottom: '8px' }}>
          KÉSZEN ÁLLSZ?
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--muted-foreground)', marginBottom: '32px' }}>
          A tenger nem ígér könnyű szelet. Csak lehetőségeket.
        </p>
        <button onClick={() => router.push('/kikoto')} style={{
          background: '#d25c1c', color: '#fdf9e0',
          border: 'none', borderRadius: '4px', padding: '16px 48px',
          fontFamily: 'var(--font-heading)', fontWeight: 700,
          fontSize: '15px', letterSpacing: '3px', cursor: 'pointer',
        }}>
          BELÉPÉS A KIKÖTŐBE →
        </button>
      </div>
    </div>
  )
}
