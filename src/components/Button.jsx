/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useRef } from 'react'
import { gsap } from 'gsap'

const useMagnetic = () => {
  const ref = useRef(null)

  const handleMouseMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    gsap.to(el, { x: x * 0.25, y: y * 0.25, duration: 0.3, ease: 'power2.out' })
  }

  const handleMouseLeave = () => {
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
  }

  return { ref, handleMouseMove, handleMouseLeave }
}

const ButtonPrimary = ({ href, target = '_self', label, icon, classes = '' }) => {
  const { ref, handleMouseMove, handleMouseLeave } = useMagnetic()
  const relValue = target === '_blank' ? 'noopener noreferrer' : undefined

  const inner = (
    <>
      {label}
      {icon && <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>}
    </>
  )

  const className = `btn btn-primary ${classes}`

  if (href) {
    return (
      <a ref={ref} href={href} target={target} rel={relValue} className={className}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        {inner}
      </a>
    )
  }

  return (
    <button ref={ref} className={className}
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {inner}
    </button>
  )
}

const ButtonOutline = ({ href, target = '_self', label, icon, classes = '' }) => {
  const { ref, handleMouseMove, handleMouseLeave } = useMagnetic()
  const relValue = target === '_blank' ? 'noopener noreferrer' : undefined

  const inner = (
    <>
      {label}
      {icon && <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>}
    </>
  )

  const className = `btn btn-outline ${classes}`

  if (href) {
    return (
      <a ref={ref} href={href} target={target} rel={relValue} className={className}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        {inner}
      </a>
    )
  }

  return (
    <button ref={ref} className={className}
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {inner}
    </button>
  )
}

export { ButtonPrimary, ButtonOutline }
