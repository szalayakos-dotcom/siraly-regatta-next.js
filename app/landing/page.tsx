'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPocketBase } from '@/lib/pocketbase'
import {
  Anchor,
  Sailboat,
  Waves,
  Trophy,
  ArrowRight,
  Wind,
  Coins,
  Compass,
  Medal,
  ClipboardList,
  Flag,
} from 'lucide-react'

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
  const [parts, setParts] = useState<{ d: number; h: number; m: number; s: number } | null>(null)
  const [done, setDone] = useState(false)
  useEffect(() => {
    function update() {
      const ms = new Date(target).getTime() - Date.now()
      if (ms <= 0) {
        setDone(true)
        return
      }
      setParts({
        d: Math.floor(ms / 86400000),
        h: Math.floor((ms % 86400000) / 3600000),
        m: Math.floor((ms % 3600000) / 60000),
        s: Math.floor((ms % 60000) / 1000),
      })
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [target])

  if (done) return <span className="font-heading text-2xl font-black text-primary">RAJT!</span>
  if (!parts) return <span className="font-heading text-2xl font-black text-primary">--:--:--</span>

  const cells = [
    parts.d > 0 ? { v: parts.d, l: 'NAP' } : null,
    { v: parts.h, l: 'ÓRA' },
    { v: parts.m, l: 'PERC' },
    { v: parts.s, l: 'MP' },
  ].filter(Boolean) as { v: number; l: string }[]

  return (
    <div className="flex items-end gap-2">
      {cells.map((c, i) => (
        <div key={i} className="flex flex-col items-center">
          <span className="font-heading text-2xl font-black leading-none text-foreground tabular-nums">
            {String(c.v).padStart(2, '0')}
          </span>
          <span className="label-caps mt-1 text-[8px] text-muted-foreground">{c.l}</span>
        </div>
      ))}
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [nextRace, setNextRace] = useState<Race | null>(null)
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
          sort: '-xp',
          perPage: 5,
        })
        setLeaders(
          profiles.slice(0, 5).map((p: any) => ({
            name: p.display_name || 'Versenyző',
            xp: p.xp || 0,
            total_races: p.total_races || 0,
            total_wins: p.total_wins || 0,
          })),
        )
      } catch {}
    }
    load()
  }, [mounted])

  if (!mounted) return null

  const steps = [
    {
      num: '01',
      icon: ClipboardList,
      title: 'Nevezz be',
      desc: 'Válassz versenyt, bérelj hajót és kapitányt. A nevezési díjat kreditből fizeted — ezeket versenyeken szerezheted.',
    },
    {
      num: '02',
      icon: Flag,
      title: 'Rajtolj el',
      desc: 'A rajt előtt 5 perccel aktívvá válik a Start gomb. Időben lépj fedélzetre és indulj — késés esetén a nevezés törlődik.',
    },
    {
      num: '03',
      icon: Waves,
      title: 'Vitorlázz',
      desc: 'Állítsd a vitorlákat és a trimet az aktuális szélhez. A fizikai motor valós polar adatok alapján számol — minden döntés számít.',
    },
    {
      num: '04',
      icon: Trophy,
      title: 'Célba érj',
      desc: 'Érintsd a bólyákat sorban és érj célba a legjobb idővel. A top 3 extra kreditet és XP-t kap, minden bólyánál 10 kredit jár.',
    },
  ]

  const facts = [
    { icon: Waves, title: 'Valós fizika', desc: 'Polar táblázatok alapján számított hajósebesség, drift és dőlés — minden vitorla- és trimbeállítás számít.' },
    { icon: Wind, title: 'Élő időjárás', desc: 'Versenyenként szakaszokra bontott széladatok — viharban refelj, jó szélben optimalizálj.' },
    { icon: Coins, title: 'Kredit rendszer', desc: 'Bólyánként 10 kredit bónusz. A top 3 befutónak extra nyeremény. Kredit egyenlegből bérelhetsz hajót, kapitányt és vehetsz felszerelést. Hajóvásárlás hamarosan.' },
    { icon: Compass, title: 'Kapitányok', desc: 'Minden kapitánynak egyedi képessége van — trimmester, viharlovas, rajtmester. Válassz okosan.' },
  ]

  const medalColor = (i: number) =>
    i === 0 ? 'text-[var(--gold)]' : i === 1 ? 'text-muted-foreground' : i === 2 ? 'text-primary' : 'text-muted-foreground'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-[var(--ink)]">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          {/* Szöveg */}
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-[oklch(0.93_0.02_92)]">
              <Anchor className="size-4" strokeWidth={1.75} />
              <span className="label-caps text-[10px] opacity-80">Balatoni Vitorlás Szimulátor</span>
            </div>

            <h1 className="font-heading mt-5 text-balance text-6xl font-black leading-[0.9] tracking-tight text-[oklch(0.97_0.01_95)] sm:text-7xl lg:text-8xl">
              Sirály
              <br />
              <span className="text-primary">Regatta</span>
            </h1>

            <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-[oklch(0.9_0.02_92)]/90">
              Szél. Víz. Barátság. Kaland. Lépj a fedélzetre, és éld át a balatoni
              vitorlásversenyeinek hangulatát — valós fizikán alapuló, böngészőből játszható regattában.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/kikoto')}
                className="group inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 font-heading text-base font-black tracking-wide text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5"
              >
                CSATLAKOZZ MOST
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
              </button>
              <button
                onClick={() => router.push('/kikoto')}
                className="inline-flex items-center gap-2 rounded-md border border-[oklch(0.97_0.01_95)]/40 px-8 py-4 font-heading text-base font-bold tracking-wide text-[oklch(0.97_0.01_95)] transition-colors hover:bg-[oklch(0.97_0.01_95)]/10"
              >
                <Sailboat className="size-4" strokeWidth={1.75} />
                NÉZD MEG A KIKÖTŐT
              </button>
            </div>

            <p className="mt-5 text-sm text-[oklch(0.85_0.02_92)]/70">
              Ingyenes · Regisztrálj és nevezz az első versenyedre percek alatt.
            </p>
          </div>

          {/* Illusztráció */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-xl border-4 border-[oklch(0.97_0.01_95)]/15 shadow-2xl">
              <img
                src="/poster-hero.jpg"
                alt="Lake Balaton Sailing Race plakát mosolygó vitorlázó párral és versenyhajókkal, festett retró stílusban"
                className="h-full w-full object-cover"
              />
              <div className="paper-grain absolute inset-0 opacity-30" aria-hidden />
            </div>
            {/* kis lebegő plakett */}
            <div className="absolute -bottom-4 -left-4 hidden rounded-lg border border-border bg-card px-5 py-3 shadow-xl sm:block">
              <p className="font-heading text-lg font-black leading-tight text-card-foreground">
                A széllel nem lehet vitatkozni.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== KÖVETKEZŐ VERSENY SÁV ===== */}
      {nextRace && (
        <section className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-5 px-6 py-6">
            <div className="min-w-[200px] flex-1">
              <span className="label-caps text-[9px] text-primary">Következő verseny</span>
              <h3 className="font-heading mt-1 text-xl font-black text-foreground">{nextRace.name}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {new Date(nextRace.scheduled_start).toLocaleString('hu-HU', {
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            <div className="border-l border-border pl-8">
              <span className="label-caps text-[9px] text-muted-foreground">Visszaszámlálás</span>
              <div className="mt-1.5">
                <Countdown target={nextRace.scheduled_start} />
              </div>
            </div>

            <button
              onClick={() => router.push('/kikoto')}
              className="group ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-heading text-xs font-bold tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              NEVEZÉS
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" strokeWidth={2} />
            </button>
          </div>
        </section>
      )}

      {/* ===== ÉLMÉNY SÁV — illusztrált ===== */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 sm:py-24 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl border border-border shadow-lg">
          <img
            src="/race-start.jpg"
            alt="Versenybíró rajtpisztolyt süt el a hajóról jelzőzászlókkal, festett retró plakát stílusban"
            className="h-full w-full object-cover"
          />
          <div className="paper-grain absolute inset-0 opacity-25" aria-hidden />
        </div>
        <div>
          <span className="label-caps text-[10px] text-primary">Több mint sport</span>
          <h2 className="font-heading mt-2 text-balance text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Életérzés a vízen
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground">
            Markold meg a kormányt, feszítsd a vitorlát, és figyeld a szelet. Minden beállítás, minden
            fordulat számít — ahogy egy igazi balatoni regattán. Itt nem csak versenyzel, hanem
            belépsz egy közösségbe, ahol a Balaton, a szél és a barátság írja a történetet.
          </p>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {facts.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== HOGYAN MŰKÖDIK ===== */}
      <section className="border-y border-border bg-muted/60">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="max-w-2xl">
            <span className="label-caps text-[10px] text-primary">Hogyan működik</span>
            <h2 className="font-heading mt-2 text-balance text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              A verseny menete
            </h2>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <div
                  key={step.num}
                  className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/40"
                >
                  <span className="font-heading pointer-events-none absolute -right-1 -top-3 text-7xl font-black text-primary/[0.07]">
                    {step.num}
                  </span>
                  <div className="flex size-11 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-heading mt-5 text-lg font-black tracking-wide text-card-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Pálya-térkép illusztráció */}
          <div className="mt-12 overflow-hidden rounded-xl border border-border shadow-lg">
            <img
              src="/lake-panorama.jpg"
              alt="Balatoni panoráma naplementében sirályokkal és vitorlásokkal, festett retró stílusban"
              className="h-[260px] w-full object-cover object-center sm:h-[360px]"
            />
          </div>
        </div>
      </section>

      {/* ===== RANGLISTA + DOBOGÓ ===== */}
      <section className="mx-auto grid max-w-6xl gap-14 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:items-center">
        {/* Ranglista */}
        <div>
          <span className="label-caps text-[10px] text-primary">Ranglista</span>
          <h2 className="font-heading mt-2 text-3xl font-black tracking-tight text-foreground">
            Top versenyzők
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Vívd ki a helyed a dobogón. Minden győzelem XP-t és örök dicsőséget hoz.
          </p>

          {leaders.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Még nincs elég adat.</p>
          ) : (
            <ol className="mt-7 flex flex-col gap-2.5">
              {leaders.map((l, i) => (
                <li
                  key={i}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
                >
                  <span className="flex w-7 shrink-0 items-center justify-center">
                    {i < 3 ? (
                      <Medal className={`size-5 ${medalColor(i)}`} strokeWidth={2} />
                    ) : (
                      <span className="font-heading text-sm font-black text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading truncate text-base font-bold text-card-foreground">
                      {l.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.total_races} verseny · {l.total_wins} győzelem
                    </div>
                  </div>
                  <div className="font-heading shrink-0 text-base font-black text-primary tabular-nums">
                    {l.xp.toLocaleString('hu-HU')} XP
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Dobogó illusztráció */}
        <div className="relative overflow-hidden rounded-xl border border-border shadow-lg">
          <img
            src="/race-podium.jpg"
            alt="Vitorlás díjkiosztó dobogó három versenyzővel és kupákkal a kikötőben, festett retró stílusban"
            className="h-full w-full object-cover"
          />
          <div className="paper-grain absolute inset-0 opacity-25" aria-hidden />
        </div>
      </section>

      {/* ===== FOOTER CTA — világítótorony illusztrációval ===== */}
      <section className="relative overflow-hidden bg-[var(--ink)]">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 lg:block">
          <img
            src="/illustration-lighthouse.png"
            alt="Világítótorony naplementében egy vitorlással, festett retró plakát stílusban"
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--ink)] via-[var(--ink)]/70 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-[oklch(0.93_0.02_92)]">
              <Anchor className="size-4" strokeWidth={1.75} />
              <span className="label-caps text-[10px] opacity-80">SIRÁLY REGATTA</span>
            </div>
            <h2 className="font-heading mt-5 text-balance text-5xl font-black tracking-tight text-[oklch(0.97_0.01_95)] sm:text-6xl">
              Állítsd be a vitorlát.
              <br />
              <span className="text-primary">A tó a tiéd.</span>
            </h2>
            <p className="mt-5 text-pretty text-lg text-[oklch(0.9_0.02_92)]/80">
              A következő verseny már vár. Nevezz be, válaszd ki a hajódat, és írd be a neved a
              Balaton legjobbjai közé.
            </p>
            <button
              onClick={() => router.push('/kikoto')}
              className="group mt-9 inline-flex items-center gap-2 rounded-md bg-primary px-9 py-4 font-heading text-base font-black tracking-wide text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5"
            >
              BELÉPÉS A KIKÖTŐBE
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
