import PocketBase from 'pocketbase'

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090'

// Browser-side singleton
let browserClient: PocketBase | null = null

export function getPocketBase(): PocketBase {
  if (typeof window === 'undefined') {
    return new PocketBase(POCKETBASE_URL)
  }
  if (!browserClient) {
    browserClient = new PocketBase(POCKETBASE_URL)
    browserClient.autoCancellation(false)
  }
  return browserClient
}

// Dinamikus verseny betöltés — active vagy published, legközelebbi scheduled_start
export async function getActiveRace(): Promise<{ id: string; [key: string]: any } | null> {
  const pb = getPocketBase()
  try {
    // Először active
    const active = await pb.collection('races').getFullList({
      filter: "status='active'",
      sort: 'scheduled_start',
    })
    if (active.length > 0) return active[0]

    // Ha nincs active, legközelebbi published
    const published = await pb.collection('races').getFullList({
      filter: "status='published'",
      sort: 'scheduled_start',
    })
    if (published.length > 0) return published[0]

    return null
  } catch {
    return null
  }
}

// Típusok
export interface Race {
  id: string
  name: string
  actual_start?: string
  scheduled_start?: string
  status: string
  course_id?: string
}

export interface WeatherSegment {
  id: string
  race_id: string
  from_cp_index: number
  wind_dir: number
  wind_speed: number
  storm_level: number
}

export interface RacePosition {
  id: string
  race_id: string
  player_id: string
  lat: number
  lng: number
  speed_kmh: number
  cp_index: number
  heading_deg: number
}

export interface PlayerRace {
  id: string
  race_id: string
  player_id: string
  boat_id: string
  credits: number
  joined_at: string
  total_time_penalty: number
  davy_jones_used: boolean
  autopilot_used: boolean
}

export interface Checkpoint {
  id: string
  race_id: string
  name: string
  lat: number
  lng: number
  order_index: number
  is_start: boolean
  is_finish: boolean
}
