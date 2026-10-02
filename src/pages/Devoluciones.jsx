import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Undo2, Repeat, Ban } from 'lucide-react'
import { db, METODO_LABEL, MOTIVO_DEV_LABEL } from '../db'
import { Page } from '../layout'
import { Empty } from '../ui'
import { money, num, periodo, fechaRelativa, initials } from '../utils'

const PERIODOS = [['semana', '7 días'], ['mes', 'Este mes'], ['mesAnterior', 'Mes anterior'], ['todo', 'Todo']]
const TIPOS = [['todas', 'Todas'], ['devolucion', 'Devoluciones'], ['cambio', 'Cambios'], ['anulacion', 'Anulaciones']]
const TIPO_INFO = {
  devolucion: { label: 'Devolución', icon: Undo2 },
  cambio: { label: 'Cambio', icon: Repeat },
  anulacion: { label: 'Anulación', icon: Ban },
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

function Barras({ rows, fmt = money }) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  return (
    <div className="stack" style={{ gap: 12 }}>
      {rows.map((r) => (
        <div key={r.k} className="hbar">
          <span className="ellipsis">{r.k}</span><b className="num">{fmt(r.v)}</b>
          <div className="hbar-track"><span style={{ width: `${(r.v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

/** Todo lo que volvió: devoluciones, cambios y ventas anuladas, con motivos y a dónde fue la plata. */
export default function Devoluciones() {
  const [per, setPer] = useState('mes')
  const [tipo, setTipo] = useState('todas')
  const p = per === 'todo' ? { desde: 0, hasta: Number.MAX_SAFE_INTEGER } : periodo(per)

  const data = useLiveQuery(async () => {
    const [devoluciones, ventas, clientas, legado] = await Promise.all([
      db.devoluciones.where('fecha').between(p.desde, p.hasta, true, true).reverse().sortBy('fecha'),
      db.ventas.where('fecha').between(p.desde, p.hasta, true, true).toArray(),
      db.clientas.toArray(),
      // Anuladas antes de que existiera el registro de devoluciones.
      db.ventas.filter((v) => v.anulada && !v.porDevolucion).toArray(),
    ])
    const cMap = Object.fromEntries(clientas.map((c) => [c.id, c]))
    const vendido = ventas.filter((v) => !v.anulada || v.porDevolucion).reduce((s, v) => s + v.total, 0)
    return { devoluciones: devoluciones.map((d) => ({ ...d, clienta: cMap[d.clientaId] })), vendido, legado: legado.filter((v) => v.fecha >= p.desde && v.fecha <= p.hasta) }
  }, [p.desde, p.hasta])

  const r = useMemo(() => {
    if (!data) return null
    const lista = data.devoluciones.filter((d) => tipo === 'todas' || d.tipo === tipo)
    const valor = lista.reduce((s, d) => s + d.valor, 0)
    const plata = lista.filter((d) => d.destino && d.destino !== 'afavor').reduce((s, d) => s + (d.destinoMonto ?? d.resto ?? 0), 0)
    const aFavor = lista.filter((d) => d.destino === 'afavor').reduce((s, d) => s + (d.destinoMonto ?? d.resto ?? 0), 0)
    const deuda = lista.reduce((s, d) => s + (d.aSaldo || 0), 0)
    const unidades = lista.reduce((s, d) => s + d.items.reduce((a, i) => a + i.cantidad, 0), 0)
    const cuenta = { devolucion: 0, cambio: 0, anulacion: 0 }
    const motivos = {}, prendas = {}, talles = {}
    lista.forEach((d) => {
      cuenta[d.tipo] = (cuenta[d.tipo] || 0) + 1
      const m = MOTIVO_DEV_LABEL[d.motivo] || 'Sin motivo'
      motivos[m] = (motivos[m] || 0) + 1
      d.items.forEach((i) => {
        prendas[i.nombre] = (prendas[i.nombre] || 0) + i.cantidad
        talles[i.talle] = (talles[i.talle] || 0) + i.cantidad
      })
    })
    const top = (o, n = 6) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v }))
    return {
      lista, valor, plata, aFavor, deuda, unidades, cuenta,
      tasa: data.vendido ? Math.round((data.devoluciones.reduce((s, d) => s + d.valor, 0) / data.vendido) * 100) : null,
      motivos: top(motivos), prendas: top(prendas), talles: top(talles, 8),
    }
  }, [data, tipo])

  return (
    <Page title="Devoluciones y anulaciones" back="/ventas">
      <div className="stack-lg">
        <div className="chips" role="group" aria-label="Período">
          {PERIODOS.map(([id, l]) => <button key={id} className="chip" aria-pressed={per === id} onClick={() => setPer(id)}>{l}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Tipo">
          {TIPOS.map(([id, l]) => <button key={id} aria-pressed={tipo === id} onClick={() => setTipo(id)}>{l}</button>)}
        </div>

        {r && (
          <>
            <div className="kpis">
              <div className="kpi hl"><div className="k">Valor devuelto</div><div className="v">{money(r.valor)}</div><div className="d">{num(r.unidades)} prendas{r.tasa !== null && tipo === 'todas' ? ` · ${r.tasa}% de lo vendido` : ''}</div></div>
              <div className="kpi"><div className="k">Plata devuelta</div><div className="v">{money(r.plata)}</div><div className="d">salió de la caja</div></div>
              <div className="kpi"><div className="k">Quedó a favor</div><div className="v">{money(r.aFavor)}</div><div className="d">saldo de clientas</div></div>
              <div className="kpi"><div className="k">Bajó de deudas</div><div className="v">{money(r.deuda)}</div><div className="d">{plural(r.cuenta.devolucion, 'devolución', 'devoluciones')} · {plural(r.cuenta.cambio, 'cambio', 'cambios')} · {plural(r.cuenta.anulacion, 'anulación', 'anulaciones')}</div></div>
            </div>

            {!r.lista.length ? (
              <Empty title="Nada volvió en este período" text="Acá aparecen las devoluciones, los cambios y las ventas anuladas, con su motivo." />
            ) : (
              <>
                <div className="two-col">
                  <section className="panel panel-pad stack"><h2 className="section-title">Por motivo</h2><Barras rows={r.motivos} fmt={(v) => `${v} ${v === 1 ? 'vez' : 'veces'}`} /></section>
                  <section className="panel panel-pad stack"><h2 className="section-title">Prendas que más vuelven</h2><Barras rows={r.prendas} fmt={(v) => `${num(v)} u.`} /></section>
                  <section className="panel panel-pad stack"><h2 className="section-title">Por talle</h2><Barras rows={r.talles} fmt={(v) => `${num(v)} u.`} /></section>
                </div>

                <section className="stack">
                  <h2 className="section-title">Detalle</h2>
                  <div className="list">
                    {r.lista.map((d) => {
                      const { label, icon: Icon } = TIPO_INFO[d.tipo] || TIPO_INFO.devolucion
                      const destino = d.destino === 'afavor' ? 'quedó a favor' : d.destino ? `devuelto en ${(METODO_LABEL[d.destino] || d.destino).toLowerCase()}` : d.tipo === 'cambio' ? 'usado en el cambio' : null
                      return (
                        <Link key={d.id} to={`/ventas/${d.ventaId}`} className="list-item">
                          <span className="avatar">{d.clienta ? initials(d.clienta.nombre) : <Icon size={18} />}</span>
                          <span className="grow" style={{ minWidth: 0 }}>
                            <span className="title ellipsis" style={{ display: 'block' }}>{d.items.map((i) => `${i.nombre} (${i.talle})${i.cantidad > 1 ? ` ×${i.cantidad}` : ''}`).join(', ')}</span>
                            <span className="subtle">{label} de #{d.ventaId} · {fechaRelativa(d.fecha)}{d.clienta ? ` · ${d.clienta.nombre}` : ''}</span><br />
                            <span className="subtle">{d.motivo ? MOTIVO_DEV_LABEL[d.motivo] : 'Sin motivo'}{destino ? ` · ${destino}` : ''}</span>
                          </span>
                          <b className="money">−{money(d.valor)}</b>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              </>
            )}

            {data.legado.length > 0 && (
              <p className="subtle">Además hay {data.legado.length} {data.legado.length === 1 ? 'venta anulada' : 'ventas anuladas'} antes de la actualización, sin detalle de devolución. Las ves en Ventas → Anuladas.</p>
            )}
          </>
        )}
      </div>
    </Page>
  )
}
