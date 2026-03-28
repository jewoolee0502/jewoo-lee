/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useState, useRef, useEffect } from 'react'

const ExperienceCard = ({ title, company, date, description }) => {
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const descRef = useRef(null)

  useEffect(() => {
    if (descRef.current) {
      const lineHeight = parseFloat(getComputedStyle(descRef.current).lineHeight)
      const lines = descRef.current.scrollHeight / lineHeight
      if (lines > 3) setIsOverflowing(true)
    }
  }, [])

  return (
    <div
      className="group py-5 sm:py-7 flex flex-col sm:flex-row gap-1 sm:gap-12 cursor-pointer"
      onClick={() => isOverflowing && setExpanded(!expanded)}
    >
      <span className="font-display text-[10px] sm:text-[11px] font-medium tracking-wider uppercase text-faint shrink-0 sm:w-44 sm:text-right pt-0.5 sm:pt-1.5">
        {date}
      </span>

      <div className="flex-1">
        <h3 className="font-display text-sm sm:text-base font-bold tracking-tight text-ink group-hover:text-ember transition-colors duration-400">
          {title}
        </h3>
        <p className="font-body text-sm italic text-muted mt-0.5">{company}</p>

        <div
          ref={descRef}
          className={`mt-3 font-body text-sm text-muted/70 leading-relaxed transition-all duration-400 ${
            !expanded ? 'max-h-[4.5rem] overflow-hidden' : ''
          }`}
          style={{
            maskImage: !expanded && isOverflowing
              ? 'linear-gradient(to bottom, black 50%, transparent 100%)'
              : 'none',
            WebkitMaskImage: !expanded && isOverflowing
              ? 'linear-gradient(to bottom, black 50%, transparent 100%)'
              : 'none'
          }}
        >
          {description.split('\n\n').map((para, i) => (
            <p key={i} className="mb-2">{para.trim()}</p>
          ))}
        </div>

        {isOverflowing && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="mt-2 font-display text-[10px] font-bold tracking-widest uppercase text-ember hover:text-ember-glow transition-colors duration-300"
          >
            {expanded ? 'Less' : 'Read more'}
          </button>
        )}
      </div>
    </div>
  )
}

export default ExperienceCard
