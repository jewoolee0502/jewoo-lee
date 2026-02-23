/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import type { HTMLAttributeAnchorTarget } from 'react'

type ButtonProps = {
  href?: string
  target?: HTMLAttributeAnchorTarget
  rel?: string
  label: string
  icon?: string
  classes?: string
}

/**
 * Primary Button
 */

const ButtonPrimary = ({
  href,
  target = '_self',
  rel,
  label,
  icon,
  classes,
}: ButtonProps) => {
  if (href) {
    const relValue = rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)

    return (
      <a
        href={href}
        target={target}
        rel={relValue}
        className={'btn btn-primary ' + (classes ?? '')}
      >
        {label}

        {icon ? (
          <span className="material-symbols-rounded" aria-hidden="true">
            {icon}
          </span>
        ) : undefined}
      </a>
    )
  }

  return (
    <button className={'btn btn-primary ' + (classes ?? '')}>
      {label}

      {icon ? (
        <span className="material-symbols-rounded" aria-hidden="true">
          {icon}
        </span>
      ) : undefined}
    </button>
  )
}

/**
 * Outline Button
 */

const ButtonOutline = ({
  href,
  target = '_self',
  rel,
  label,
  icon,
  classes,
}: ButtonProps) => {
  if (href) {
    const relValue = rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)

    return (
      <a
        href={href}
        target={target}
        rel={relValue}
        className={'btn btn-outline ' + (classes ?? '')}
      >
        {label}

        {icon ? (
          <span className="material-symbols-rounded" aria-hidden="true">
            {icon}
          </span>
        ) : undefined}
      </a>
    )
  }

  return (
    <button className={'btn btn-outline ' + (classes ?? '')}>
      {label}

      {icon ? (
        <span className="material-symbols-rounded" aria-hidden="true">
          {icon}
        </span>
      ) : undefined}
    </button>
  )
}

export { ButtonPrimary, ButtonOutline }
