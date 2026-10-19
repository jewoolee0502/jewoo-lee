// Desktop icons (L712–716); saved drawings are appended to the right column (L1002–1003).
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'
import { ICON } from '../lib/pixelIcons.js'

const DESK_L = [
  ['about', 'About.txt', 'doc'],
  ['projects', 'Projects', 'folder'],
  ['exp', 'Experience.log', 'log'],
  ['skills', 'Skills.inv', 'chest'],
  ['term', 'Terminal', 'term'],
  ['resume', 'Resume.pdf', 'pdf'],
  ['mail', 'Mail', 'mail'],
  ['display', 'Wallpaper', 'display'],
]

const DESK_R = [
  ['bugs', 'BugHunt.exe', 'bug'],
  ['snake', 'Snake.exe', 'snake'],
  ['paint', 'Paint', 'paint'],
  ['wall', 'Visitor Wall', 'wall'],
  ['service', 'Service.txt', 'tag'],
  ['ach', 'Trophies', 'trophy'],
  ['bin', 'Recycle Bin', 'bin'],
]

function Icon({ id, label, src }) {
  const app = useApp()
  return (
    <button className="ic" onClick={() => app.os.openApp(id)}>
      <img alt="" src={src} />
      <span>{label}</span>
    </button>
  )
}

export default function DesktopIcons() {
  const { os } = useApp()
  const art = useStore(os.store, (s) => s.art)
  return (
    <>
      <div className="icons l" id="icons-l">
        {DESK_L.map(([id, label, icon]) => (
          <Icon key={id} id={id} label={label} src={ICON[icon]} />
        ))}
      </div>
      <div className="icons r" id="icons-r">
        {DESK_R.map(([id, label, icon]) => (
          <Icon key={id} id={id} label={label} src={ICON[icon]} />
        ))}
        {art.map((src, n) => (
          <Icon key={'art:' + n} id={'art:' + n} label={'my-art-' + n + '.png'} src={src} />
        ))}
      </div>
    </>
  )
}
