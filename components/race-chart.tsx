'use client'

import { useEffect, useRef, useState } from 'react'
import { Panel } from './panel'
import { getPocketBase, RACE_ID } from '@/lib/pocketbase'

export function RaceChart() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const myMarkerRef = useRef<any>(null)
  const [mounted, setMounted] = useState(false)
  const [following, setFollowing] = useState(false)
  const followingRef = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return

    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      const map = L.map(mapRef.current!, {
        center: [46.88, 17.78],
        zoom: 11,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        opacity: 0.85,
      }).addTo(map)

      mapInstanceRef.current = map

      // Pálya pontok betöltése a versenyhez rendelt course-ból
      const pb = getPocketBase()
      try {
        const race = await pb.collection('races').getOne(RACE_ID)
        if (race.course_id) {
          const course = await pb.collection('courses').getOne(race.course_id)
          const points = typeof course.points === 'string' ? JSON.parse(course.points || '[]') : (course.points || [])
          const mainPts = points.filter((p: any) => p.type === 'start' || p.type === 'checkpoint' || p.type === 'finish')
            .sort((a: any, b: any) => a.order - b.order)
          mainPts.forEach((cp: any) => {
            const color = cp.type === 'start' ? '#c42b1c' : cp.type === 'finish' ? '#c8a030' : '#2a6a7a'
            const icon = L.divIcon({
              html: `<div style="background:${color};color:#fff;font-size:9px;padding:2px 5px;font-family:sans-serif;font-weight:700;white-space:nowrap;box-shadow:1px 1px 4px rgba(0,0,0,0.4)">${cp.name}</div>`,
              className: '',
              iconAnchor: [0, 0],
            })
            L.marker([cp.lat, cp.lng], { icon }).addTo(map)
          })
          if (mainPts.length > 1) {
            L.polyline(mainPts.map((c: any) => [c.lat, c.lng] as [number, number]), {
              color: '#c42b1c', weight: 2, opacity: 0.5, dashArray: '6 5',
            }).addTo(map)
          }
        }
      } catch (e) {}

      // Pozíciók betöltése
      loadPositions(L, map)
      pb.collection('race_positions').subscribe('*', () => loadPositions(L, map))
    }

    async function loadPositions(L: any, map: any) {
      const pb = getPocketBase()
      try {
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${RACE_ID}"`,
        })
        const myId = pb.authStore.record?.id

        // Nevek és hajó adatok betöltése
        const sorted = [...positions].sort((a: any, b: any) =>
          (b.cp_index||0)-(a.cp_index||0) || (b.speed_kmh||0)-(a.speed_kmh||0)
        )

        const infoMap: Record<string, { name: string; boatName: string; boatClass: string; boatType: string; pos: number }> = {}
        await Promise.all(positions.map(async (pos: any, i: number) => {
          let userName = 'Versenyző'
          let boatName = '—'; let boatClass = '—'; let boatType = '—'
          try {
            const user = await pb.collection('users').getOne(pos.player_id)
            userName = user.name || user.email || 'Versenyző'
          } catch {}
          try {
            const pr = await pb.collection('player_races').getFirstListItem(
              `race_id="${RACE_ID}" && player_id="${pos.player_id}"`
            )
            const boat = await pb.collection('boats').getOne(pr.boat_id)
            boatName = boat.name || '—'
            boatType = boat.type_name || '—'
            const classMap: Record<string, string> = {
              '9g4us1y1ye7afym': 'Ys.I', '40t0bopld7pwwo4': 'Ys.II', 'lgtakoks0p1jnvd': 'Ys.III'
            }
            boatClass = classMap[boat.class_id] || '—'
          } catch {}
          const standing = sorted.findIndex((p: any) => p.player_id === pos.player_id) + 1
          infoMap[pos.player_id] = { name: userName, boatName, boatClass, boatType, pos: standing }
        }))

        positions.forEach((pos: any) => {
          const isMine = pos.player_id === myId
          const size = isMine ? 32 : 22
          const info = infoMap[pos.player_id] || { name: 'Versenyző', boatName: '—', boatClass: '—', boatType: '—', pos: 0 }
          const speedKn = Math.round((pos.speed_kmh || 0) * 0.539957 * 10) / 10
          const tooltipHtml = `
            <div style="font-family:sans-serif;min-width:140px;line-height:1.5">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px">${isMine ? '⛵ Te' : '⛵ ' + info.name}</div>
              <div style="font-size:11px;color:#666">${info.boatName} · ${info.boatClass}</div>
              <div style="font-size:11px;color:#666">${info.boatType}</div>
              <div style="font-size:11px;margin-top:4px">
                <span style="color:#c42b1c;font-weight:700">#${info.pos}</span>
                <span style="color:#666;margin-left:8px">${speedKn} kn</span>
                <span style="color:#666;margin-left:8px">CP ${pos.cp_index || 0}</span>
              </div>
            </div>`
          const icon = L.divIcon({
            html: `<div style="width:${size}px;height:${size}px;background:${isMine ? '#c42b1c' : '#2a6a7a'};border:2px solid ${isMine ? '#c8a030' : 'rgba(255,255,255,0.4)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${isMine ? 15 : 11}px;box-shadow:0 2px 6px rgba(0,0,0,0.5)">⛵</div>`,
            className: '',
            iconAnchor: [size / 2, size / 2],
          })
          if (isMine) {
            if (myMarkerRef.current) {
              myMarkerRef.current.setLatLng([pos.lat, pos.lng])
              myMarkerRef.current.setTooltipContent(tooltipHtml)
            } else {
              myMarkerRef.current = L.marker([pos.lat, pos.lng], { icon }).addTo(map)
              myMarkerRef.current.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -size/2], opacity: 0.95 })
            }
            if (followingRef.current) map.panTo([pos.lat, pos.lng])
          } else {
            if (markersRef.current[pos.player_id]) {
              markersRef.current[pos.player_id].setLatLng([pos.lat, pos.lng])
              markersRef.current[pos.player_id].setTooltipContent(tooltipHtml)
            } else {
              markersRef.current[pos.player_id] = L.marker([pos.lat, pos.lng], { icon }).addTo(map)
              markersRef.current[pos.player_id].bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -size/2], opacity: 0.95 })
            }
          }
        })
      } catch (e) {}
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [mounted])

  function toggleFollow() {
    const next = !following
    setFollowing(next)
    followingRef.current = next
    if (next && myMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(myMarkerRef.current.getLatLng())
    }
  }

  return (
    <Panel title="Balaton — Élő Térkép" code="MAP" bodyClassName="p-0 overflow-hidden">
      <div style={{ position: 'relative' }}>
        <div ref={mapRef} style={{ height: '360px', width: '100%' }} />
        <button
          onClick={toggleFollow}
          style={{
            position: 'absolute', bottom: '12px', right: '12px', zIndex: 1000,
            background: following ? 'var(--secondary)' : 'var(--card)',
            color: following ? 'var(--secondary-foreground)' : 'var(--foreground)',
            border: '1px solid var(--border)', borderRadius: '4px',
            padding: '6px 12px', fontFamily: 'var(--font-heading)',
            fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
            cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}
        >
          {following ? '⛵ KÖVETÉS BE' : '⛵ KÖVETÉS'}
        </button>
      </div>
    </Panel>
  )
}
