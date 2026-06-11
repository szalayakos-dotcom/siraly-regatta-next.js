'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getPocketBase } from '@/lib/pocketbase'

interface RaceContextType {
  raceId: string | null
  race: any | null
  loading: boolean
}

const RaceContext = createContext<RaceContextType>({ raceId: null, race: null, loading: true })

export function useRace() {
  return useContext(RaceContext)
}

export function RaceProvider({ children }: { children: ReactNode }) {
  const [race, setRace] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const pb = getPocketBase()

    async function load() {
      try {
        // Először active
        const active = await pb.collection('races').getFullList({
          filter: "status='active'",
          sort: 'scheduled_start',
        })
        if (active.length > 0) { setRace(active[0]); setLoading(false); return }

        // Ha nincs active, legközelebbi published
        const published = await pb.collection('races').getFullList({
          filter: "status='published'",
          sort: 'scheduled_start',
        })
        if (published.length > 0) { setRace(published[0]); setLoading(false); return }

        setRace(null)
      } catch {
        setRace(null)
      }
      setLoading(false)
    }

    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <RaceContext.Provider value={{ raceId: race?.id || null, race, loading }}>
      {children}
    </RaceContext.Provider>
  )
}
