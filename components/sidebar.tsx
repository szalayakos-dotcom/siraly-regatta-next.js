'use client'

import {
  Compass, Sailboat, Map, Wind, Trophy, Anchor, Wrench, Users, Settings, LogOut, LifeBuoy,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getPocketBase } from '@/lib/pocketbase'

const nav = [
  { icon: Compass,  label: 'Fedélzet',     code: '01', href: '/dashboard' },
  { icon: Map,      label: 'Térkép',        code: '02', href: '/dashboard' },
  { icon: Wind,     label: 'Időjárás',      code: '03', href: '/dashboard' },
  { icon: Sailboat, label: 'Flotta',        code: '04', href: '/dashboard' },
  { icon: Trophy,   label: 'Versenyek',     code: '05', href: '/dashboard' },
  { icon: Anchor,   label: 'Kikötő',        code: '06', href: '/kikoto' },
  { icon: Wrench,   label: 'Vitorlázat',    code: '07', href: '/dashboard' },
  { icon: Users,    label: 'Legénység',     code: '08', href: '/dashboard' },
]

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsername] = useState('Vendég')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const pb = getPocketBase()
    if (pb.authStore.isValid) {
      setIsLoggedIn(true)
      setUsername(pb.authStore.record?.name || pb.authStore.record?.email || 'Kapitány')
    }
  }, [])

  function handleLogout() {
    const pb = getPocketBase()
    pb.authStore.clear()
    window.location.href = '/kikoto'
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      {/* Embléma fejléc */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <img
          src="/sidebar-crest.png"
          alt="Sirály Regatta embléma"
          className="size-11 shrink-0 rounded-sm object-cover"
        />
        <div className="min-w-0">
          <p className="font-heading text-sm font-black leading-tight tracking-wide text-sidebar-foreground">
            SIRÁLY REGATTA
          </p>
          <p className="label-caps text-[9px] text-sidebar-foreground/45">Balaton · 1899</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="label-caps px-3 pb-2 text-[9px] text-sidebar-foreground/40">
          Navigáció
        </p>
        <ul className="flex flex-col gap-0.5">
          {nav.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => { if (item.href) router.push(item.href) }}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary-foreground/80" />
                  )}
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="font-heading text-sm font-medium tracking-wide">{item.label}</span>
                  <span className={cn('ml-auto font-mono text-[10px]', isActive ? 'text-sidebar-primary-foreground/70' : 'text-sidebar-foreground/35')}>
                    {item.code}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border px-3 py-3">
        {isLoggedIn ? (
          <>
            <div className="mb-1 flex items-center gap-3 px-3 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 font-heading text-sm font-bold text-sidebar-primary">
                {username.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-semibold text-sidebar-foreground">{username}</p>
                <p className="label-caps text-[9px] text-sidebar-foreground/50">Rang: Kapitány</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
              <span className="font-heading text-sm tracking-wide">Kilépés</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => (window.location.href = '/login')}
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LifeBuoy className="size-4" strokeWidth={1.75} />
            <span className="font-heading text-sm tracking-wide">Bejelentkezés</span>
          </button>
        )}
        <div
          className="flex w-full items-center gap-3 rounded-sm px-3 py-2 cursor-not-allowed select-none opacity-30 pointer-events-none"
        >
          <Settings className="size-4" strokeWidth={1.75} />
          <span className="font-heading text-sm tracking-wide">Beállítások</span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
