/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useEffect, useState } from 'react'

const ScrollProgress = () => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? scrollTop / docHeight : 0)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 hidden sm:block">
      <div className="relative w-[2px] h-24 bg-ink/[0.06] rounded-full overflow-hidden">
        <div
          className="absolute bottom-0 left-0 w-full bg-ember rounded-full transition-[height] duration-100"
          style={{ height: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

export default ScrollProgress
