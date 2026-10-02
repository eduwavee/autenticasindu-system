import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { TrendingUp, Undo2 } from 'lucide-react'
import { db, CATEGORIAS, actualizarPrecios, deshacerPrecios, nuevoPrecio } from '../db'
import { Page } from '../layout'
import { Confirm, Empty, useToast } from '../ui'
import { money, fechaRelativa } from '../utils'

const REDONDEOS = [[0, 'Sin redondear'], [100, 'A $100'], [500, 'A $500'], [1000, 'A $1.000']]

export default function Precios() {
  const toast = useToast()
  const nav = useNavigate()
  const productos = useLiveQuery(() => db.productos.toArray(), [])
  const [sentido, setSentido] = useState('subir')
  const [pct, setPct] = useState('')
  const [redondeo, setRedondeo] = useState(100)
  const [cats, setCats] = useState(new Set())
  const [ocultas, setOcultas] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const pctReal = (Number(pct) || 0) * (sentido === 'bajar' ? -1 : 1)
  const elegidos = useMemo(() => (productos || [])
    .filter((p) => (ocultas || p.activo !== 0) && (!cats.size || cats.has(p.categoria)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre)), [productos, cats, ocultas])
  const cambios = elegidos.map((p) => ({ ...p, nuevo: nuevoPrecio(p.precio, pctReal, redondeo) })).filter((p) => p.nuevo !== p.precio)
  const ultima = Math.max(0, ...(productos || []).map((p) => p.precioCambiado || 0))
  const deshacibles = (productos || []).filter((p) => ultima && p.precioCambiado === ultima && p.precioAnterior).length
  const toggleCat = (c) => setCats((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n })
  const catsUsadas = CATEGORIAS.filter((c) => productos?.some((p) => p.categoria === c))

  return (
    <Page title="Actualizar precios" back="/stock">
      <div className="stack-lg" style={{ maxWidth: 640, margin: '0 auto' }}>
        {productos && !productos.length ? <Empty title="Todavía no hay prendas" text="Cargá prendas para poder actualizar sus precios." /> : (
          <>
            <section className="panel panel-pad stack">
              <div className="seg" role="group" aria-label="Subir o bajar">
                <button aria-pressed={sentido === 'subir'} onClick={() => setSentido('subir')}>Subir</button>
                <button aria-pressed={sentido === 'bajar'} onClick={() => setSentido('bajar')}>Bajar (promo)</button>
              </div>
              <label className="field"><span>Porcentaje</span>
                <div className="input-pct"><input className="input num" inputMode="numeric" placeholder="Ej: 8" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d]/g, '').slice(0, 3))} autoFocus /><span aria-hidden="true">%</span></div>
              </label>
              <div className="stack" style={{ gap: 6 }}>
                <span className="label">Redondeo</span>
                <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }} role="group" aria-label="Redondeo">
                  {REDONDEOS.map(([r, l]) => <button key={r} className="chip" aria-pressed={redondeo === r} onClick={() => setRedondeo(r)}>{l}</button>)}
                </div>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <span className="label">Qué prendas {cats.size ? '' : '(todas)'}</span>
                <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }} role="group" aria-label="Categorías">
                  {catsUsadas.map((c) => <button key={c} className="chip" aria-pressed={cats.has(c)} onClick={() => toggleCat(c)}>{c}</button>)}
                </div>
              </div>
              <label className="row"><input type="checkbox" checked={ocultas} onChange={(e) => setOcultas(e.target.checked)} /> Incluir prendas ocultas</label>
            </section>

            {pctReal !== 0 && (
              <section className="stack">
                <h2 className="section-title">{cambios.length ? `Cambian ${cambios.length} ${cambios.length === 1 ? 'precio' : 'precios'}` : 'Con ese redondeo no cambia ningún precio'}</h2>
                {cambios.length > 0 && (
                  <div className="list" style={{ maxHeight: '44dvh', overflowY: 'auto' }}>
                    {cambios.map((p) => (
                      <div key={p.id} className="list-item">
                        <span className="grow ellipsis">{p.nombre}</span>
                        <span className="subtle money" style={{ textDecoration: 'line-through' }}>{money(p.precio)}</span>
                        <b className="money">{money(p.nuevo)}</b>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn btn-primary btn-lg btn-block" disabled={!cambios.length} onClick={() => setConfirm('aplicar')}>
                  <TrendingUp /> {sentido === 'subir' ? 'Subir' : 'Bajar'} {pct}% a {cambios.length} {cambios.length === 1 ? 'prenda' : 'prendas'}
                </button>
              </section>
            )}

            {deshacibles > 0 && (
              <section className="panel panel-pad stack">
                <p className="muted">Última actualización: {fechaRelativa(ultima)} ({deshacibles} {deshacibles === 1 ? 'prenda' : 'prendas'}).</p>
                <button className="btn btn-ghost" onClick={() => setConfirm('deshacer')}><Undo2 /> Volver a los precios anteriores</button>
              </section>
            )}
          </>
        )}
      </div>
      <Confirm open={confirm === 'aplicar'} onClose={() => setConfirm(null)} title="¿Actualizar los precios?" confirmLabel="Actualizar"
        text={`Se cambia el precio de ${cambios.length} ${cambios.length === 1 ? 'prenda' : 'prendas'}. Las ventas ya hechas no cambian. Podés deshacerlo después.`}
        onConfirm={async () => { const n = await actualizarPrecios(cambios.map((p) => p.id), pctReal, redondeo); toast(`${n} precios actualizados`); nav('/stock') }} />
      <Confirm open={confirm === 'deshacer'} onClose={() => setConfirm(null)} title="¿Volver a los precios anteriores?" confirmLabel="Deshacer"
        text="Las prendas de la última actualización vuelven al precio que tenían antes."
        onConfirm={async () => { const n = await deshacerPrecios(); toast(`${n} precios restaurados`) }} />
    </Page>
  )
}
