'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Anchor } from 'lucide-react'

export default function SplashPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [entering, setEntering] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleEnter() {
    setEntering(true)
    setTimeout(() => router.push('/landing'), 600)
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-primary">
      {/* Háttérkép */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out"
        style={{
          backgroundImage: 'url(/poster.png)',
          opacity: mounted && !entering ? 1 : 0,
        }}
      />

      {/* Sötét overlay a kontraszthoz */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 12%, transparent) 0%, color-mix(in oklch, var(--foreground) 55%, transparent) 55%, color-mix(in oklch, var(--foreground) 90%, transparent) 100%)',
          opacity: entering ? 0 : 1,
        }}
      />

      {/* Tartalom */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-end pb-[12vh] transition-all duration-500 ease-out"
        style={{
          opacity: mounted && !entering ? 1 : 0,
          transform: entering ? 'translateY(20px)' : 'translateY(0)',
        }}
      >
        <div className="mb-12 text-center">
          <p className="mb-5 flex items-center justify-center gap-3 font-sans text-xs uppercase tracking-[0.4em] text-background/70 sm:text-sm">
            <Anchor className="h-4 w-4" aria-hidden="true" />
            Balatoni Vitorlás Szimulátor
            <Anchor className="h-4 w-4" aria-hidden="true" />
          </p>
          <h1 className="text-balance font-serif text-6xl font-black leading-[0.95] tracking-[0.08em] text-background drop-shadow-[0_4px_32px_rgba(0,0,0,0.5)] sm:text-7xl md:text-8xl">
            SIRÁLY
            <br />
            REGATTA
          </h1>
        </div>

        <button
          type="button"
          onClick={handleEnter}
          className="rounded-sm border-2 border-background/80 px-14 py-4 font-sans text-sm font-bold uppercase tracking-[0.4em] text-background transition-colors duration-200 hover:border-background hover:bg-background/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          Belépés
        </button>
      </div>
    </main>
  )
}
