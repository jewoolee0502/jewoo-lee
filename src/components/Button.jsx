/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */


/**
 * Node modules
 */
import PropTypes from 'prop-types';

/**
 * Primary Button
 */

const ButtonPrimary = ({
  href,
  target = '_self',
  label,
  icon,
  classes
}) => {
  if (href) {
    const relValue = target === '_blank' ? 'noopener noreferrer' : undefined;

    return (
      <a
        href={href}
        target={target}
        relValue={relValue}
        className={"btn btn-primary " + classes}
      >
        {label}

        {icon ?
          <span
            className='material-symbols-rounded'
            aria-hidden="true"
          >
            {icon}
          </span>
          : undefined
        }
      </a>
    )
  } else {
    return (
      <button className={"btn btn-primary " + classes}>
        {label}

        {icon ?
          <span
            className='material-symbols-rounded'
            aria-hidden="true"
          >
            {icon}
          </span>
          : undefined
        }
      </button>
    )
  }
}

ButtonPrimary.propTypes = {
  label: PropTypes.string.isRequired,
  href: PropTypes.string,
  target: PropTypes.string,
  icon: PropTypes.string,
  classes: PropTypes.string
}


/**
 * Outline Button
 */

const ButtonOutline = ({
  href,
  target = '_self',
  label,
  icon,
  classes
}) => {
  if (href) {
    const relValue = target === '_blank' ? 'noopener noreferrer' : undefined;

    return (
      <a
        href={href}
        target={target}
        rel={relValue}
        className={"btn btn-outline " + classes}
      >
        {label}

        {icon ?
          <span
            className='material-symbols-rounded'
            aria-hidden="true"
          >
            {icon}
          </span>
          : undefined
        }
      </a>
    )
  } else {
    return (
      <button className={"btn btn-outline " + classes}>
        {label}

        {icon ?
          <span
            className='material-symbols-rounded'
            aria-hidden="true"
          >
            {icon}
          </span>
          : undefined
        }
      </button>
    )
  }
}

ButtonOutline.propTypes = {
  label: PropTypes.string.isRequired,
  href: PropTypes.string,
  target: PropTypes.string,
  icon: PropTypes.string,
  classes: PropTypes.string
}


export {
  ButtonPrimary,
  ButtonOutline
}
