import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useFotoUrl } from './hooks'

/* ---------- Etiqueta colgante ---------- */
export function Tag({ children, rose = false, string = false, className = '', faceClass = '', style }) {
  return (
    <div className={`tag ${rose ? 'tag-rose' : ''} ${className}`} style={style}>
      {string && (
        <svg className="tag-string" viewBox="0 0 46 32" fill="none" aria-hidden="true">
          <path d="M23 26 C 14 18, 10 6, 4 2 M23 26 C 30 16, 38 8, 44 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
      <span className="tag-eyelet" aria-hidden="true" />
      <div className={`tag-face ${faceClass}`}>{children}</div>
    </div>
  )
}

/* ---------- Perchero: una percha por talle ---------- */
function HangerIcon({ dashed }) {
  return (
    <svg viewBox="0 0 46 34" fill="none" aria-hidden="true">
      <path d="M23 13 V9.5 a3.6 3.6 0 1 0 -3.6 -3.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M23 13 L3.5 27.5 Q1.6 31 5.4 31 H40.6 Q44.4 31 42.5 27.5 Z"
        stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"
        strokeDasharray={dashed ? '3 3' : undefined}
        fill={dashed ? 'none' : 'currentColor'} fillOpacity={dashed ? 0 : 0.1}
      />
    </svg>
  )
}

/**
 * items: [{ key, talle, stock, color? }]
 * onPick: si viene, las perchas son botones (selección de talle)
 */
export function Rack({ items, stockBajo = 2, selected, onPick, mini = false, label = 'Talles' }) {
  if (!items.length) return <p className="subtle">Sin talles cargados.</p>
  return (
    <div className={`rack ${mini ? 'rack-mini' : ''}`} role={onPick ? 'group' : 'list'} aria-label={label}>
      <div className="rack-rail" aria-hidden="true" />
      <div className="rack-hangers">
        {items.map((it) => {
          const out = it.stock <= 0
          const low = !out && it.stock <= stockBajo
          const cls = `hanger ${out ? 'out' : ''} ${low ? 'low' : ''}`
          const inner = (
            <>
              <HangerIcon dashed={out} />
              <span className="h-size">{it.talle}</span>
              <span className="h-count">{mini ? it.stock : out ? 'agotado' : `${it.stock} u.`}</span>
            </>
          )
          const title = `${it.talle}${it.color ? ' · ' + it.color : ''}: ${out ? 'sin stock' : it.stock + ' unidades'}`
          return onPick ? (
            <button key={it.key} type="button" className={cls} disabled={out} aria-pressed={selected === it.key} onClick={() => onPick(it)} title={title} aria-label={title}>
              {inner}
            </button>
          ) : (
            <div key={it.key} className={cls} role="listitem" title={title} aria-label={title}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Ilustraciones de prenda (placeholder cuando no hay foto) ---------- */
const GARMENTS = {
  'Remeras y tops': <path d="M23 10 L12 16 L6 28 L14 32 L18 27 V56 H46 V27 L50 32 L58 28 L52 16 L41 10 Q32 18 23 10 Z" />,
  Vestidos: <><path d="M26 6 V14 L20 22 L11 58 H53 L44 22 L38 14 V6" /><path d="M26 14 Q32 19 38 14" /><path d="M20 30 H44" /></>,
  Pantalones: <><path d="M18 6 H46 L50 58 H36 L32 25 L28 58 H14 Z" /><path d="M18 12 H46" /></>,
  Faldas: <><path d="M20 12 H44 L54 54 H10 Z" /><path d="M20 18 H44" /><path d="M27 18 L24 54 M37 18 L40 54" /></>,
  Abrigos: <><path d="M23 8 L10 14 L6 54 H16 L18 30 V58 H46 V30 L48 54 H58 L54 14 L41 8 L32 22 Z" /><path d="M32 22 V58" /></>,
  Accesorios: <><path d="M14 26 H50 L46 56 H18 Z" /><path d="M24 26 V20 a8 8 0 0 1 16 0 V26" /></>,
}
export function GarmentArt({ categoria }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {GARMENTS[categoria] || GARMENTS['Remeras y tops']}
    </svg>
  )
}
export function ProductImg({ producto }) {
  const url = useFotoUrl(producto?.foto)
  return url
    ? <img src={url} alt="" loading="lazy" />
    : <GarmentArt categoria={producto?.categoria} />
}

/* ---------- Hoja inferior ---------- */
export function Sheet({ open, onClose, title, children, labelledBy }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector('input, select, textarea, button:not(.icon-btn)')?.focus({ preventScroll: true })
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} ref={ref}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ open, title, text, confirmLabel = 'Confirmar', danger = false, onConfirm, onClose, children, disabled = false }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const confirmar = async () => {
    setBusy(true)
    try { await onConfirm(); onClose() } catch (e) { toast(e?.message || 'No se pudo completar.', 'error') } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack">
        {text && <p className="muted">{text}</p>}
        {children}
        <div className="grid-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy || disabled} onClick={confirmar}>{confirmLabel}</button>
        </div>
      </div>
    </Sheet>
  )
}

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const timer = useRef()
  const show = useCallback((text, kind = 'ok') => {
    setMsg({ text, kind, id: Date.now() })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), kind === 'error' ? 5000 : 2600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {msg && <div className={`toast ${msg.kind === 'error' ? 'toast-error' : ''}`} key={msg.id} role={msg.kind === 'error' ? 'alert' : undefined}>{msg.kind === 'error' ? <AlertCircle /> : <CheckCircle2 />}{msg.text}</div>}
      </div>
    </ToastCtx.Provider>
  )
}
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastCtx)

/* ---------- Varios ---------- */
export function MoneyInput({ value, onChange, id, placeholder = '0', autoFocus, ...rest }) {
  return (
    <div className="input-money">
      <input
        id={id} className="input" inputMode="numeric" placeholder={placeholder} autoFocus={autoFocus}
        value={value === 0 || value ? new Intl.NumberFormat('es-AR').format(value) : ''}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '')
          onChange(raw === '' ? '' : Number(raw))
        }}
        {...rest}
      />
    </div>
  )
}

export function Empty({ art, title, text, action }) {
  return (
    <div className="empty">
      {art}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function EmptyRackArt() {
  return (
    <svg className="empty-art" viewBox="0 0 120 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 10 H114" strokeWidth="3.5" />
      <path d="M30 22 V18 a3 3 0 1 0 -3 -3" /><path d="M30 22 L14 34 H46 Z" strokeDasharray="3 3" />
      <path d="M60 22 V18 a3 3 0 1 0 -3 -3" /><path d="M60 22 L44 34 H76 Z" strokeDasharray="3 3" />
      <path d="M90 22 V18 a3 3 0 1 0 -3 -3" /><path d="M90 22 L74 34 H106 Z" strokeDasharray="3 3" />
    </svg>
  )
}
