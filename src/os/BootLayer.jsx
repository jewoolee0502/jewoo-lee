// Boot log and splash (L315, L682–686).
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'

function BootLine({ text, tag }) {
  return (
    <div>
      {text}
      {tag ? <span className={tag === 'OK' ? 'ok' : 'warn'}>{tag === 'LOW' ? 'LOW (refill advised)' : tag}</span> : null}
    </div>
  )
}

export default function BootLayer() {
  const { os } = useApp()
  const lines = useStore(os.store, (s) => s.bootLines)
  const splashing = useStore(os.store, (s) => s.splashing)
  const barFull = useStore(os.store, (s) => s.barFull)
  return (
    <div className={splashing ? 'layer l-boot splashing' : 'layer l-boot'} id="l-boot">
      <pre id="boot-log">
        {lines.map((line, i) => (
          <BootLine key={i} text={line.text} tag={line.tag} />
        ))}
      </pre>
      <div className="splash">
        <div className="logo">JAY-OS</div>
        <div className="bar">
          <i id="boot-bar" style={barFull ? { width: '100%' } : undefined} />
        </div>
      </div>
    </div>
  )
}
