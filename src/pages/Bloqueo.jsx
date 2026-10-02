import { useState } from 'react'
import { Delete, Lock } from 'lucide-react'
import { hashPin } from '../db'
import { Tag } from '../ui'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar']

/** Teclado de PIN. Lo usan el bloqueo y Ajustes (para crear el PIN). */
export function PinPad({ value, onChange, onComplete, largo = 4, error }) {
  const tocar = (k) => {
    if (k === 'borrar') return onChange(value.slice(0, -1))
    if (!k || value.length >= largo) return
    const v = value + k
    onChange(v)
    if (v.length === largo) onComplete?.(v)
  }
  return (
    <div className="stack" style={{ gap: 16, alignItems: 'center' }}>
      <div className={`pin-dots ${error ? 'shake' : ''}`} aria-label={`${value.length} de ${largo} dígitos`}>
        {Array.from({ length: largo }, (_, i) => <span key={i} className={i < value.length ? 'on' : ''} />)}
      </div>
      <div className="pin-pad">
        {TECLAS.map((k, i) => k === '' ? <span key={i} /> : (
          <button key={i} type="button" onClick={() => tocar(k)} aria-label={k === 'borrar' ? 'Borrar' : k}>
            {k === 'borrar' ? <Delete /> : k}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Bloqueo({ cfg, onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [ayuda, setAyuda] = useState(false)

  const probar = async (v) => {
    if ((await hashPin(v)) === cfg.pinHash) { onUnlock(); return }
    setError(true)
    setTimeout(() => { setPin(''); setError(false) }, 450)
  }

  return (
    <div className="onboard">
      <Tag string>
        <div className="stack" style={{ gap: 18, alignItems: 'center', textAlign: 'center' }}>
          <Lock size={28} style={{ color: 'var(--rose-700)' }} />
          <div className="stack" style={{ gap: 4 }}>
            <h1>{cfg.tienda}</h1>
            <p className="muted">Ingresá tu PIN</p>
          </div>
          <PinPad value={pin} onChange={setPin} onComplete={probar} error={error} />
          {error && <p className="field-error" role="alert">PIN incorrecto</p>}
          <button className="link-btn" onClick={() => setAyuda(!ayuda)}>¿Te olvidaste el PIN?</button>
          {ayuda && (
            <p className="subtle" style={{ maxWidth: 34 + 'ch' }}>
              El PIN no se puede recuperar. Si tenés un backup, podés borrar los datos del sitio desde la configuración del navegador y restaurarlo al volver a entrar.
            </p>
          )}
        </div>
      </Tag>
    </div>
  )
}
