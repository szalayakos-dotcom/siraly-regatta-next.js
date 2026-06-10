'use client'

import { useState, useEffect } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Trophy, Map, Ship, Users, Cloud, Anchor, Settings, LogOut, Zap, ChevronRight
} from 'lucide-react'

const nav = [
  { href: '/admin',              icon: Zap,     label: 'God mód' },
  { href: '/admin/races',        icon: Trophy,  label: 'Versenyek' },
  { href: '/admin/courses',      icon: Map,     label: 'Pályák' },
  { href: '/admin/weather',      icon: Cloud,   label: 'Időjárás' },
  { href: '/admin/boats',        icon: Ship,    label: 'Hajók' },
  { href: '/admin/captains',     icon: Anchor,  label: 'Kapitányok' },
  { href: '/admin/users',        icon: Users,   label: 'Felhasználók' },
  { href: '/admin/settings',     icon: Settings,label: 'Beállítások' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    const pb = getPocketBase()
    if (pb.authStore.isValid) {
      setAuthed(true)
    }
    setLoading(false)
  }, [])

  function handleLogout() {
    getPocketBase().authStore.clear()
    window.location.href = '/'
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="label-caps text-muted-foreground">Betöltés...</p>
    </div>
  )

  if (!authed) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <AdminLogin onSuccess={() => setAuthed(true)} />
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-5 py-4">
          <p className="font-heading text-lg font-bold text-sidebar-foreground">ADMIN</p>
          <p className="label-caps text-[9px] text-sidebar-foreground/40">Sirály Regatta</p>
        </div>
        <nav className="flex-1 px-2 py-3">
          {nav.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 rounded-sm px-3 py-2.5 font-heading text-sm font-medium tracking-wide transition-colors',
                pathname === href
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}>
              <Icon className="size-4 shrink-0" strokeWidth={1.75}/>
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent">
            <LogOut className="size-4" strokeWidth={1.75}/>
            Kilépés
          </button>
        </div>
      </aside>

      {/* Mobil bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-sidebar lg:hidden">
        {nav.slice(0, 5).map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[8px] font-medium tracking-wide transition-colors',
              pathname === href
                ? 'text-sidebar-primary-foreground bg-sidebar-primary/20'
                : 'text-sidebar-foreground/50'
            )}>
            <Icon className="size-5" strokeWidth={1.75}/>
            <span className="label-caps">{label.slice(0,6)}</span>
          </Link>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        {children}
      </main>
    </div>
  )
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')

  async function login() {
    try {
      const pb = getPocketBase()
      await pb.collection('_superusers').authWithPassword(email, pass)
      onSuccess()
    } catch {
      try {
        const pb = getPocketBase()
        await pb.collection('users').authWithPassword(email, pass)
        onSuccess()
      } catch {
        setErr('Hibás email vagy jelszó')
      }
    }
  }

  return (
    <div className="w-80 rounded-sm border border-border bg-card p-6 shadow-lg">
      <p className="font-heading text-xl font-bold text-foreground mb-1">Admin belépés</p>
      <p className="label-caps text-[9px] text-muted-foreground mb-5">Sirály Regatta</p>
      <div className="flex flex-col gap-3">
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
        <input type="password" placeholder="Jelszó" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary"/>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <button onClick={login}
          className="w-full rounded-sm bg-foreground py-2 font-heading text-sm font-semibold text-background hover:bg-secondary transition-colors">
          Belépés
        </button>
      </div>
    </div>
  )
}
