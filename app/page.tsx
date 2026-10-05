'use client'

import { useState, type FormEvent } from 'react'
import s from './page.module.css'

// A KVF Supabase-projektje, NYILVÁNOS (anon) kulcs — csak beszúrni enged a
// siraly_subscribers táblába, olvasni nem (RLS). Ugyanez a kulcs van az index.html-ben is.
const SB_URL = 'https://lxyxdikxsescjneipznk.supabase.co'
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4eXhkaWt4c2VzY2puZWlwem5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDM5MjEsImV4cCI6MjA5NTIxOTkyMX0.WmxT7eUJZ52l9y55ZZTlov8Qw4hKV9cQWIh_g7bMgX4'

type State = 'idle' | 'sending' | 'ok' | 'err'

export default function Page() {
  const [email, setEmail] = useState('')
  const [hp, setHp] = useState('')
  const [state, setState] = useState<State>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (hp) { setState('ok'); return }            // robot (rejtett mező kitöltve)
    const v = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || v.length > 254) { setState('err'); return }
    setState('sending')
    try {
      const r = await fetch(SB_URL + '/rest/v1/siraly_subscribers', {
        method: 'POST',
        headers: {
          apikey: SB_ANON,
          Authorization: 'Bearer ' + SB_ANON,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email: v }),
      })
      // 409 = már feliratkozott — a felhasználónak ez is siker
      setState(r.ok || r.status === 409 ? 'ok' : 'err')
    } catch {
      setState('err')
    }
  }

  return (
    <main className={s.wrap}>
      <div className={s.card}>
        <h1 className={s.title}>Sirály Regatta</h1>
        <p className={s.sub}>Hamarosan új formában a Balatonon. Iratkozz fel, és szólunk, amikor indul.</p>
        {state === 'ok' ? (
          <p className={s.msg + ' ' + s.ok} role="status">Köszönjük! Szólunk, amikor indul.</p>
        ) : (
          <form className={s.form} onSubmit={submit} noValidate>
            <label htmlFor="email" className={s.hp}>E-mail cím</label>
            <input id="email" className={s.input} type="email" inputMode="email" autoComplete="email"
              placeholder="E-mail címed" value={email} onChange={e => { setEmail(e.target.value); if (state === 'err') setState('idle') }}
              required aria-invalid={state === 'err'} />
            <input className={s.hp} tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={e => setHp(e.target.value)} />
            <button className={s.btn} type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Küldés…' : 'Feliratkozom'}
            </button>
          </form>
        )}
        {state === 'err' && <p className={s.msg + ' ' + s.err} role="alert">Nem sikerült. Ellenőrizd az e-mail címet, és próbáld újra.</p>}
        <p className={s.note}>A címedet csak az indulásról szóló értesítéshez használjuk.</p>
      </div>
    </main>
  )
}
