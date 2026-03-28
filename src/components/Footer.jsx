/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

const socials = [
  { label: 'GitHub', href: 'https://github.com/jewoolee0502' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jewoo-lee/' },
  { label: 'Instagram', href: 'https://www.instagram.com/jwuu_lee/' },
]

const Footer = () => {
  return (
    <footer className="py-8 border-t border-ink/[0.04]">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-body text-xs italic text-faint/60">
          &copy; 2025 Jewoo Lee
        </p>

        <div className="flex items-center gap-6">
          {socials.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-[10px] font-bold tracking-widest uppercase text-faint hover:text-ember transition-colors duration-300"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}

export default Footer
