/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useMemo } from 'react'

const ParticleBackground = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      opacity: 0.1 + Math.random() * 0.3,
      duration: 12 + Math.random() * 18,
      delay: Math.random() * 15,
    }))
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map(({ id, left, size, opacity, duration, delay }) => (
        <div
          key={id}
          className="absolute rounded-full bg-ink"
          style={{
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            opacity,
            animation: `particleFall ${duration}s ${delay}s linear infinite`,
          }}
        />
      ))}
    </div>
  )
}

export default ParticleBackground
