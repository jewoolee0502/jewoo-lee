/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

const Sidebar = ({ sections, activeSection, onNavigate }) => {
  return (
    <aside className="relative w-72 h-screen flex flex-col shrink-0 bg-gradient-to-b from-void via-surface/40 to-void border-r border-ink/[0.04]">

      {/* Ambient glow at top */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-ember/[0.03] to-transparent pointer-events-none" />

      {/* Wordmark */}
      <div className="relative px-8 pt-10 pb-12">
        <button
          onClick={() => onNavigate('home')}
          className="group flex flex-col"
        >
          <span className="font-display text-2xl font-bold tracking-tight text-ink group-hover:text-ember transition-colors duration-500">
            Jewoo Lee
          </span>
          <span className="font-body text-sm italic text-muted mt-0.5">
            Software Engineer
          </span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-0.5">
        {sections.map(({ id, label, icon }) => {
          const isActive = activeSection === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`relative w-full flex items-center gap-3.5 px-4 py-3 rounded-lg font-display text-[13px] font-medium tracking-wide uppercase transition-all duration-400 ${
                isActive
                  ? 'text-ember bg-ember/[0.06]'
                  : 'text-muted hover:text-ink hover:bg-ink/[0.03]'
              }`}
            >
              <span className={`material-symbols-rounded text-[18px] transition-colors duration-400 ${isActive ? 'text-ember' : ''}`}>
                {icon}
              </span>
              {label}

              {/* Active bar */}
              {isActive && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-l-full bg-ember" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="relative px-8 pb-8 space-y-5">
        {/* Divider line */}
        <div className="h-px bg-gradient-to-r from-transparent via-ink/[0.06] to-transparent" />

        {/* Vertical email */}
        <a
          href="mailto:jewoo.lee@mail.mcgill.ca"
          className="font-display text-[10px] font-bold tracking-[0.2em] uppercase text-faint hover:text-ember transition-colors duration-300"
        >
          jewoo.lee@mail.mcgill.ca
        </a>

        <a
          href="/files/JEWOOLEE_CV.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 font-display text-xs font-medium tracking-wider uppercase text-muted hover:text-ember transition-colors duration-300"
        >
          <span className="material-symbols-rounded text-[16px]">download</span>
          Resume
        </a>

        <div className="flex items-center gap-5">
          {[
            { label: 'Github', full: 'GitHub', href: 'https://github.com/jewoolee0502' },
            { label: 'Linkedin', full: 'LinkedIn', href: 'https://www.linkedin.com/in/jewoo-lee/' },
          ].map(({ label, full, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={full}
              className="font-display text-[11px] font-bold tracking-widest uppercase text-faint hover:text-ember transition-colors duration-300"
            >
              {label}
            </a>
          ))}
        </div>

        <p className="font-body text-[11px] italic text-faint/60">
          &copy; 2025
        </p>
      </div>
    </aside>
  )
}

export default Sidebar
