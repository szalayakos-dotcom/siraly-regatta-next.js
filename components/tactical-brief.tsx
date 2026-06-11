'use client'

import { useState } from 'react'
import { Panel } from './panel'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import { Skull, X } from 'lucide-react'

const CARDS = [
  { id:'vizibiciklis', emoji:'🚲', title:'Vizibiciklis!', text:'Egy lelkes vizibiciklis pont elédvágott. 2 percet vesztettél.', good:false, penalty:120 },
  { id:'horgasz', emoji:'⛵', title:'Csónakos horgász', text:'Keresztezte az utad. 1 percet vesztettél.', good:false, penalty:60 },
  { id:'hinar', emoji:'🪼', title:'Hínármező', text:'2 percig 20%-kal csökkent a sebességed.', good:false },
  { id:'kormanyhiba', emoji:'🔧', title:'Kormányhiba', text:'5 percig csak 60%-os sebesség.', good:false },
  { id:'szelcsend', emoji:'💨', title:'Szélcsend fogoly', text:'6 percig 40%-os sebességre vagy kárhoztatva.', good:false },
  { id:'horgony', emoji:'⚓', title:'Horgony a lábon', text:'4 percet vesztettél.', good:false, penalty:240 },
  { id:'kotelek', emoji:'🪢', title:'Elszakadt a kötél', text:'Kényszervitorlacsere + 1 perc.', good:false, penalty:60 },
  { id:'poff', emoji:'💨', title:'Kaptál egy pöfföt!', text:'+10% sebesség 5 percig.', good:true },
  { id:'tukros', emoji:'🌊', title:'Tükrös víz', text:'Drift esélyed feleződik 5 percig.', good:true },
  { id:'titkos', emoji:'🗺', title:'Titkos útvonal', text:'1 km megspórolva.', good:true },
  { id:'mentes', emoji:'💰', title:'Hős a Balatonon', text:'+20 kredit!', good:true, credits:20 },
  { id:'bar', emoji:'🍺', title:'Balatonfüredi bár', text:'+15% sebesség 5 percig.', good:true },
]

export function TacticalBrief() {
  const { raceId } = useRace()
  const [davyUsed, setDavyUsed] = useState(false)
  const [drawnCard, setDrawnCard] = useState<typeof CARDS[0] | null>(null)
  const [phase, setPhase] = useState<'idle'|'flipping'|'zoomed'|'done'|'returning'|'idle-used'>('idle')

  async function drawDavyCard() {
    if (davyUsed || phase !== 'idle') return
    const card = CARDS[Math.floor(Math.random() * CARDS.length)]
    setDrawnCard(card)
    setDavyUsed(true)
    setPhase('flipping')

    // Flip → zoom out to center
    setTimeout(() => setPhase('zoomed'), 700)

    try {
      const pb = getPocketBase()
      if (pb.authStore.isValid) {
        const pr = await pb.collection('player_races').getList(1, 1, {
          filter: `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`,
        })
        if (pr.items.length) {
          const updates: any = { davy_jones_used: true }
          if ((card as any).penalty) updates.total_time_penalty = (pr.items[0].total_time_penalty || 0) + (card as any).penalty
          if ((card as any).credits) updates.credits = (pr.items[0].credits || 0) + (card as any).credits
          await pb.collection('player_races').update(pr.items[0].id, updates)
        }
      }
    } catch (e) {}
  }

  function closeOverlay() {
    // Overlay eltűnik, kártya visszafordul
    setPhase('returning')
    setTimeout(() => setPhase('idle-used'), 700)
  }

  async function buyTipp(type: 'weather' | 'route') {
    if (tippPhase !== 'idle' && tippPhase !== 'done') return
    setLoading(true)
    setTippType(type)
    const dirs = ['É','ÉK','K','DK','D','DNy','Ny','ÉNy']
    try {
      const pb = getPocketBase()
      const segs = await pb.collection('weather_segments').getFullList({
        filter: `race_id="${raceId}"`, sort: 'from_cp_index',
      })
      const next = segs[1] || segs[0]
      if (type === 'weather') {
        const dir = dirs[Math.round(((next.wind_dir % 360) + 360) % 360 / 45) % 8]
        setTippResult(`${dir} szél, ${next.wind_speed} kn — ${next.storm_level > 0 ? '⚠ Viharjelzés!' : 'Normál körülmények'}`)
      } else {
        const routes = ['Parti útvonal', 'Nyílt víz', 'Középső sáv']
        const route = routes[Math.floor(Math.random() * routes.length)]
        setTippResult(`Javasolt: ${route} — ${Math.round(50 + Math.random() * 30)}%-ban megbízható.`)
      }
    } catch (e) {
      setTippResult('Tipp nem elérhető.')
    }
    setLoading(false)
    setTippPhase('flipping')
    setTimeout(() => setTippPhase('zoomed'), 700)
  }

  function closeTippOverlay() {
    setTippPhase('returning')
    setTimeout(() => setTippPhase('done'), 700)
  }

  return (
    <>
      <Panel title="Taktikai Iroda" code="TAC" bodyClassName="flex flex-col gap-3">

        {/* DAVY JONES */}
        <div className="rounded-sm border border-border bg-background/60 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Skull className="size-4 text-destructive" strokeWidth={1.75}/>
            <p className="font-heading text-xs font-semibold text-foreground">Davy Jones</p>
          </div>

          <div className="flex justify-center">
            <div style={{ perspective: '600px', width: '110px', height: '154px' }}>
              <div
                onClick={!davyUsed ? drawDavyCard : undefined}
                style={{
                  width: '100%', height: '100%',
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s ease',
                  transform: (phase === 'flipping' || phase === 'zoomed') ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  cursor: davyUsed ? 'default' : 'pointer',
                }}
              >
                {/* HÁTLAP */}
                <div style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                  borderRadius: '6px', overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                  <img src="/davy-card.svg" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  {!davyUsed && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.25)', borderRadius: '6px',
                    }}>
                      <span style={{ color: '#fff', fontSize: '10px', fontFamily: 'serif', fontWeight: 700, letterSpacing: '2px' }}>HÚZZ!</span>
                    </div>
                  )}
                </div>

                {/* ELŐLAP — kártya keret SVG */}
                <div style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderRadius: '6px', overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  <img src="/davy-card-front.svg" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  {drawnCard && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', padding: '16px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '28px', marginBottom: '6px' }}>{drawnCard.emoji}</div>
                      <p style={{
                        fontSize: '9px', fontWeight: 700, fontFamily: 'serif',
                        color: drawnCard.good ? '#166534' : '#991b1b', lineHeight: 1.3,
                      }}>{drawnCard.title}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {(phase === 'idle-used' || phase === 'done') && drawnCard && (
            <div className={`mt-3 rounded-sm p-2 text-center text-[10px] ${drawnCard.good ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <span className="font-semibold">{drawnCard.title}</span><br/>
              <span className="text-muted-foreground">{drawnCard.text}</span>
            </div>
          )}
        </div>

      </Panel>



      {/* FULLSCREEN OVERLAY — kizoomolt kártya */}
      {(phase === 'zoomed') && drawnCard && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(26,42,58,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease',
          }}
          onClick={closeOverlay}
        >
          <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes zoomIn{from{transform:scale(0.3)}to{transform:scale(1)}}`}</style>
          <div
            style={{
              position: 'relative', width: '320px', height: '448px',
              animation: 'zoomIn 0.4s ease',
              borderRadius: '12px', overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Kártya előlap nagy méretben */}
            <img src="/davy-card-front.svg" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}/>

            {/* Tartalom a kártyán */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '40px 32px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>{drawnCard.emoji}</div>
              <p style={{
                fontFamily: 'serif', fontSize: '20px', fontWeight: 700,
                color: drawnCard.good ? '#166534' : '#7f1d1d',
                marginBottom: '12px', lineHeight: 1.2,
              }}>{drawnCard.title}</p>
              <p style={{
                fontSize: '13px', color: '#374151', lineHeight: 1.6,
                fontFamily: 'sans-serif',
              }}>{drawnCard.text}</p>
            </div>

            {/* Bezárás */}
            <button
              onClick={closeOverlay}
              style={{
                position: 'absolute', top: '12px', right: '12px',
                background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}
            >
              <X size={16}/>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
