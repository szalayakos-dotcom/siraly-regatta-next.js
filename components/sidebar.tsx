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
  const [active, setActive] = useState('Fedélzet')
  const [username, setUsername] = useState('Vendég')
  const [credits, setCredits] = useState(0)
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
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Poster kép — teljes kép */}
      <div style={{ width: '100%', flexShrink: 0 }}>
        <img
          src="/poster.svg"
          alt=""
          style={{ width: '100%', display: 'block', opacity: 0.9 }}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        <p className="label-caps px-3 pb-2 text-[9px] text-sidebar-foreground/40">
          Navigáció
        </p>
        <ul className="flex flex-col gap-0.5">
          {nav.map((item) => {
            const Icon = item.icon
            const isActive = active === item.label
            return (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => { setActive(item.label); if (item.href) router.push(item.href) }}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
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
            <div className="px-3 py-2 mb-1">
              <p className="font-heading text-sm font-semibold text-sidebar-foreground">{username}</p>
              <p className="label-caps text-[9px] text-sidebar-foreground/50">Rang: Kapitány</p>
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
            onClick={() => window.location.href = '/login'}
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LifeBuoy className="size-4" strokeWidth={1.75} />
            <span className="font-heading text-sm tracking-wide">Bejelentkezés</span>
          </button>
        )}
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Settings className="size-4" strokeWidth={1.75} />
          <span className="font-heading text-sm tracking-wide">Beállítások</span>
        </button>
      </div>
    </aside>
  )
}
