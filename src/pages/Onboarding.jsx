import { useState } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { setConfig } from '../db'
import { cargarDemo } from '../seed'
import { Tag } from '../ui'

export default function Onboarding() {
  const [tienda, setTienda] = useState('Auténticas')
  const [whatsapp, setWhatsapp] = useState('')
  const [busy, setBusy] = useState(false)

  const empezar = async (demo) => {
    setBusy(true)
    await setConfig({ tienda: tienda.trim() || 'Auténticas', whatsapp: whatsapp.trim() })
    if (demo) await cargarDemo()
    else await setConfig({ onboarded: true })
  }

  return (
    <div className="onboard">
      <Tag string>
        <div className="stack" style={{ gap: 18 }}>
          <div className="stack" style={{ gap: 6 }}>
            <h1>Tu tienda, en el bolsillo</h1>
            <p className="muted">Ventas, caja, stock por talle, clientas y catálogo. Funciona sin internet y todo queda guardado en este celular.</p>
          </div>
          <label className="field">
            <span>Nombre de la tienda</span>
            <input className="input" value={tienda} onChange={(e) => setTienda(e.target.value)} />
          </label>
          <label className="field">
            <span>WhatsApp de la tienda (opcional)</span>
            <input className="input" inputMode="tel" placeholder="381 555 0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </label>
          <div className="stack" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => empezar(false)}>
              Empezar con mi tienda <ArrowRight />
            </button>
            <button className="btn btn-soft btn-block" disabled={busy} onClick={() => empezar(true)}>
              <Sparkles /> Probar con datos de ejemplo
            </button>
            <p className="subtle" style={{ textAlign: 'center' }}>Los datos de ejemplo se borran desde Ajustes cuando quieras.</p>
          </div>
        </div>
      </Tag>
    </div>
  )
}
