'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SplashPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [entering, setEntering] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function handleEnter() {
    setEntering(true)
    setTimeout(() => router.push('/landing'), 600)
  }

  if (!mounted) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      background: '#e8621a',
    }}>
      {/* Háttér SVG */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/poster.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: entering ? 0 : 1,
        transition: 'opacity 0.6s ease',
      }}/>

      {/* Sötét overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(2,15,25,0.15) 0%, rgba(2,15,25,0.7) 60%, rgba(2,15,25,0.92) 100%)',
        opacity: entering ? 0 : 1,
        transition: 'opacity 0.6s ease',
      }}/>

      {/* Tartalom */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: '10vh',
        opacity: entering ? 0 : 1,
        transform: entering ? 'translateY(20px)' : 'translateY(0)',
        transition: 'all 0.5s ease',
      }}>
        {/* Logo / cím */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(48px, 8vw, 96px)',
            fontWeight: 900,
            color: '#fdf9e0',
            letterSpacing: '6px',
            lineHeight: 1,
            textShadow: '0 4px 32px rgba(0,0,0,0.5)',
            marginBottom: '8px',
          }}>
            SIRÁLY
          </div>
          <div style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(48px, 8vw, 96px)',
            fontWeight: 900,
            color: '#fdf9e0',
            letterSpacing: '6px',
            lineHeight: 1,
            textShadow: '0 4px 32px rgba(0,0,0,0.5)',
            marginBottom: '16px',
          }}>
            REGATTA
          </div>
          <div style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 'clamp(11px, 1.5vw, 14px)',
            letterSpacing: '6px',
            color: 'rgba(253,249,224,0.6)',
            textTransform: 'uppercase',
          }}>
            ⚓ &nbsp; Balatoni Vitorlás Szimulátor &nbsp; ⚓
          </div>
        </div>

        {/* Belépés gomb */}
        <button
          onClick={handleEnter}
          style={{
            background: 'transparent',
            border: '2px solid rgba(253,249,224,0.8)',
            borderRadius: '2px',
            padding: '16px 56px',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '6px',
            color: '#fdf9e0',
            cursor: 'pointer',
            textTransform: 'uppercase',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.background = 'rgba(253,249,224,0.15)'
            ;(e.target as HTMLButtonElement).style.borderColor = '#fdf9e0'
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = 'transparent'
            ;(e.target as HTMLButtonElement).style.borderColor = 'rgba(253,249,224,0.8)'
          }}
        >
          BELÉPÉS
        </button>
      </div>
    </div>
  )
}
