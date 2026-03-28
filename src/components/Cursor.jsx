/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

const Cursor = () => {
  const cursorRef = useRef(null)
  const [isTouch, setIsTouch] = useState(false)
  const pos = useRef({ x: 0, y: 0 })
  const prev = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      setIsTouch(true)
      return
    }

    const cursor = cursorRef.current
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.6, ease: 'power3.out' })
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.6, ease: 'power3.out' })

    const handleMouseMove = (e) => {
      prev.current = { ...pos.current }
      pos.current = { x: e.clientX, y: e.clientY }

      xTo(e.clientX)
      yTo(e.clientY)

      // Stretch based on velocity
      const dx = e.clientX - prev.current.x
      const dy = e.clientY - prev.current.y
      const speed = Math.min(Math.sqrt(dx * dx + dy * dy), 40)
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      const stretch = 1 + speed * 0.02

      gsap.to(cursor, {
        scaleX: stretch,
        scaleY: 2 - stretch,
        rotation: angle,
        duration: 0.3,
        ease: 'power2.out',
        overwrite: 'auto'
      })

      // Settle back to circle when still
      gsap.to(cursor, {
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        duration: 0.6,
        delay: 0.1,
        ease: 'elastic.out(1, 0.4)',
        overwrite: false
      })
    }

    const handleEnter = () => {
      gsap.to(cursor, {
        width: 48,
        height: 48,
        opacity: 0.5,
        duration: 0.3,
        ease: 'power2.out'
      })
    }

    const handleLeave = () => {
      gsap.to(cursor, {
        width: 12,
        height: 12,
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      })
    }

    window.addEventListener('mousemove', handleMouseMove)

    const addListeners = () => {
      document.querySelectorAll('a, button, [data-cursor-hover], [data-cursor-view]').forEach((el) => {
        el.addEventListener('mouseenter', handleEnter)
        el.addEventListener('mouseleave', handleLeave)
      })
    }

    addListeners()
    const observer = new MutationObserver(addListeners)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      observer.disconnect()
    }
  }, [])

  if (isTouch) return null

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 w-3 h-3 rounded-full bg-ember pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 mix-blend-difference"
      style={{ willChange: 'transform, width, height' }}
    />
  )
}

export default Cursor
