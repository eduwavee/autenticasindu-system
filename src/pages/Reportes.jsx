import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, METODO_LABEL, CANALES, MOTIVO_AJUSTE_LABEL } from '../db'
import { useConfig } from '../store'
import { useAhora } from '../hooks'
import { Page } from '../layout'
import { Empty, ProductImg } from '../ui'
import { money, num, periodo, periodoAnterior, variacion, startOfDay, hoyISO, dateAIso, diasDesde, DIA } from '../utils'

function BarChart({ series, labelEvery = 1 }) {
  const [hover, setHover] = useState(null)
  const W = 640, H = 180, pad = { l: 8, r: 8, t: 14, b: 22 }
  const max = Math.max(1, ...series.map((s) => s.v))
  const n = series.length
  const slot = (W - pad.l - pad.r) / n
  const bw = Math.max(4, Math.min(28, slot - 2))
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const shown = hover ?? series.findIndex((s) => s.today)
  const s = series[shown]
  return (
    <div>
      <div className="row-between" style={{ minHeight: 22, fontSize: 'var(--fs-sm)' }}>
        <span className="muted">{s ? s.label : 'Pasá el dedo por las barras'}</span>
        {s && <b className="money">{money(s.v)}</b>}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ventas por período" onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map((f) => <line key={f} className="grid" x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} />)}
        <line className="grid" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} style={{ stroke: 'var(--line-2)' }} />
        {series.map((d, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2
          const h = Math.max(d.v > 0 ? 2 : 0, H - pad.b - y(d.v))
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
              <path className={`bar ${d.today ? 'today' : ''}`} style={hover === i ? { fill: 'var(--rose-800)' } : undefined}
                d={h > 0 ? `M${x},${H - pad.b} V${H - pad.b - h + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - pad.b} Z` : ''} />
              <title>{`${d.label}: ${money(d.v)}`}</title>
              {i % labelEvery === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle">{d.short}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function HBars({ rows, fmt = money }) {
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

async function leerPeriodo(desde, hasta) {
  const [ventas, cobros, gastos, devoluciones] = await Promise.all([
    db.ventas.where('fecha').between(desde, hasta, true, true).toArray(),
    db.cobros.where('fecha').between(desde, hasta, true, true).toArray(),
    db.gastos.where('fecha').between(desde, hasta, true, true).toArray(),
    db.devoluciones.where('fecha').between(desde, hasta, true, true).toArray(),
  ])
  // Las anuladas con el sistema nuevo cuentan como venta + devolución (cada una en su día).
  // Las anuladas antes de la actualización no tienen devolución registrada: se excluyen.
  return { ventas: ventas.filter((v) => !v.anulada || v.porDevolucion), cobros, gastos, devoluciones }
}

function resumen({ ventas, cobros, gastos, devoluciones }) {
  const bruto = ventas.reduce((s, v) => s + v.total, 0)
  const devuelto = devoluciones.reduce((s, d) => s + d.valor, 0)
  const vendido = bruto - devuelto
  const cmv = ventas.reduce((s, v) => s + v.items.reduce((a, i) => a + (i.costo || 0) * i.cantidad, 0), 0) - devoluciones.reduce((s, d) => s + (d.costo || 0), 0)
  const gastado = gastos.reduce((s, g) => s + g.monto, 0)
  const cobrado = cobros.reduce((s, c) => s + c.monto, 0)
  const unidades = ventas.reduce((s, v) => s + v.items.reduce((a, i) => a + i.cantidad, 0), 0) - devoluciones.reduce((s, d) => s + d.items.reduce((a, i) => a + i.cantidad, 0), 0)
  const bruta = vendido - cmv
  return { vendido, devuelto, cmv, gastado, cobrado, unidades, bruta, neta: bruta - gastado, cant: ventas.filter((v) => !v.anulada).length }
}

function Delta({ actual, antes, invert = false }) {
  const d = variacion(actual, antes)
  if (d === null) return null
  const bien = invert ? d <= 0 : d >= 0
  return <span className={`delta ${d === 0 ? '' : bien ? 'up' : 'down'}`}>{d > 0 ? '+' : ''}{d}%</span>
}

const PERIODOS = [['hoy', 'Hoy'], ['semana', '7 días'], ['mes', 'Este mes'], ['mesAnterior', 'Mes anterior'], ['rango', 'Elegir fechas']]

export default function Reportes() {
  const cfg = useConfig()
  const ahora = useAhora()
  const [per, setPer] = useState('mes')
  const [rDesde, setRDesde] = useState(() => dateAIso(Date.now() - 29 * DIA))
  const [rHasta, setRHasta] = useState(hoyISO)
  const p = periodo(per, rDesde, rHasta)
  const ant = periodoAnterior(p)

  const data = useLiveQuery(async () => {
    const [actual, previo, ajustes] = await Promise.all([
      leerPeriodo(p.desde, p.hasta), leerPeriodo(ant.desde, ant.hasta),
      db.ajustes.where('fecha').between(p.desde, p.hasta, true, true).toArray(),
    ])
    return { actual, previo, ajustes }
  }, [p.desde, p.hasta, ant.desde, ant.hasta])

  // Mercadería que salió del stock sin venderse (fallas, pérdidas, uso), valuada a costo.
  const perdida = useMemo(() => {
    if (!data) return null
    const neg = data.ajustes.filter((a) => a.delta < 0)
    const por = {}
    neg.forEach((a) => { const k = MOTIVO_AJUSTE_LABEL[a.motivo] || a.motivo; por[k] = (por[k] || 0) + -a.delta * (a.costo || 0) })
    return { unidades: neg.reduce((s, a) => s - a.delta, 0), costo: neg.reduce((s, a) => s - a.delta * (a.costo || 0), 0), por: Object.entries(por).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v })) }
  }, [data])

  const quietas = useLiveQuery(async () => {
    const [productos, variantes, ventas] = await Promise.all([db.productos.toArray(), db.variantes.toArray(), db.ventas.toArray()])
    const ultima = {}
    ventas.forEach((v) => { if (!v.anulada) v.items.forEach((i) => { if ((ultima[i.productoId] || 0) < v.fecha) ultima[i.productoId] = v.fecha }) })
    const stock = {}
    variantes.forEach((v) => { stock[v.productoId] = (stock[v.productoId] || 0) + v.stock })
    return productos.filter((x) => x.activo !== 0 && stock[x.id] > 0).map((x) => ({ ...x, stock: stock[x.id], desde: ultima[x.id] || x.creado || null, vendida: !!ultima[x.id] }))
  }, [])

  const r = useMemo(() => {
    if (!data) return null
    const { ventas, cobros, devoluciones } = data.actual
    const base = resumen(data.actual)
    const prev = resumen(data.previo)

    const prod = {}, metodo = {}, canal = {}, cat = {}, talle = {}
    const sumar = (i, signo) => {
      prod[i.nombre] = (prod[i.nombre] || 0) + signo * i.cantidad
      cat[i.categoria || 'Otras'] = (cat[i.categoria || 'Otras'] || 0) + signo * i.precio * i.cantidad
      talle[i.talle] = (talle[i.talle] || 0) + signo * i.cantidad
    }
    ventas.forEach((v) => {
      canal[v.canal] = (canal[v.canal] || 0) + v.total - (v.devuelto || 0)
      v.items.forEach((i) => sumar(i, 1))
    })
    devoluciones.forEach((d) => d.items.forEach((i) => sumar(i, -1)))
    cobros.forEach((c) => { metodo[c.metodo] = (metodo[c.metodo] || 0) + c.monto })
    const top = (o, map = (k) => k, n = 6) => Object.entries(o).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k: map(k), v }))

    let series
    if (per === 'hoy') {
      series = Array.from({ length: 13 }, (_, h) => ({ h: h + 9, v: 0 }))
      ventas.forEach((v) => { const s = series.find((x) => x.h === new Date(v.fecha).getHours()); if (s) s.v += v.total })
      devoluciones.forEach((d) => { const s = series.find((x) => x.h === new Date(d.fecha).getHours()); if (s) s.v -= d.valor })
      series = series.map((s) => ({ v: Math.max(0, s.v), label: `${s.h}:00 a ${s.h + 1}:00`, short: `${s.h}`, today: false }))
    } else {
      series = []
      for (let t = p.desde; t <= p.hasta; t += DIA) {
        const d = new Date(t)
        series.push({ t: startOfDay(d), v: 0, label: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }), short: String(d.getDate()), today: startOfDay(d) === startOfDay() })
      }
      ventas.forEach((v) => { const s = series.find((x) => x.t === startOfDay(v.fecha)); if (s) s.v += v.total })
      devoluciones.forEach((d) => { const s = series.find((x) => x.t === startOfDay(d.fecha)); if (s) s.v -= d.valor })
      series = series.map((s) => ({ ...s, v: Math.max(0, s.v) }))
    }
    return {
      ...base, prev,
      margen: base.vendido ? Math.round((base.bruta / base.vendido) * 100) : 0,
      topProd: top(prod), topMet: top(metodo, (k) => METODO_LABEL[k] || k), topCanal: top(canal, (k) => CANALES.find((c) => c.id === k)?.label || k),
      topCat: top(cat), topTalle: top(talle, (k) => k, 8), series,
    }
  }, [data, per, p.desde, p.hasta])

  const diasQuieta = cfg?.diasQuieta || 60
  const listaQuietas = (quietas || [])
    .map((x) => ({ ...x, dias: x.desde ? diasDesde(x.desde, ahora) : null }))
    .filter((x) => x.dias !== null && x.dias >= diasQuieta)
    .sort((a, b) => b.dias - a.dias)
  const plataQuieta = listaQuietas.reduce((s, x) => s + x.stock * (x.costo || 0), 0)

  return (
    <Page title="Reportes" back="/mas">
      <div className="stack-lg">
        <div className="chips" role="group" aria-label="Período">
          {PERIODOS.map(([id, l]) => <button key={id} className="chip" aria-pressed={per === id} onClick={() => setPer(id)}>{l}</button>)}
        </div>
        {per === 'rango' && (
          <div className="grid-2">
            <label className="field"><span>Desde</span><input type="date" className="input" value={rDesde} max={rHasta} onChange={(e) => e.target.value && setRDesde(e.target.value)} /></label>
            <label className="field"><span>Hasta</span><input type="date" className="input" value={rHasta} min={rDesde} max={hoyISO()} onChange={(e) => e.target.value && setRHasta(e.target.value)} /></label>
          </div>
        )}
        {r && (
          <>
            <div className="kpis">
              <div className="kpi hl"><div className="k">Ganancia neta</div><div className="v">{money(r.neta)}</div><div className="d">ventas − costo − gastos <Delta actual={r.neta} antes={r.prev.neta} /></div></div>
              <div className="kpi"><div className="k">Vendido</div><div className="v">{money(r.vendido)}</div><div className="d">{r.cant} ventas · {r.unidades} prendas <Delta actual={r.vendido} antes={r.prev.vendido} /></div></div>
              <div className="kpi"><div className="k">Ganancia bruta</div><div className="v">{money(r.bruta)}</div><div className="d">margen {r.margen}% · costo {money(r.cmv)}</div></div>
              <div className="kpi"><div className="k">Gastos</div><div className="v">{money(r.gastado)}</div><div className="d">cobrado {money(r.cobrado)} <Delta actual={r.gastado} antes={r.prev.gastado} invert /></div></div>
            </div>
            <p className="subtle">Comparado con {ant.label}: vendiste {money(r.prev.vendido)} en {r.prev.cant} ventas.{r.devuelto > 0 ? <> Ya están descontadas <Link to="/ventas/devoluciones">devoluciones por {money(r.devuelto)}</Link>.</> : ''}</p>

            {r.cant === 0 && r.devuelto === 0 ? <Empty title="Sin ventas en este período" text="Cuando registres ventas, acá vas a ver cuánto ganaste y qué se vende más." /> : (
              <>
                <section className="panel panel-pad stack">
                  <h2 className="section-title">{per === 'hoy' ? 'Ventas por hora' : 'Ventas por día'}</h2>
                  <BarChart series={r.series} labelEvery={r.series.length > 16 ? Math.ceil(r.series.length / 10) : 1} />
                </section>
                <div className="two-col">
                  <section className="panel panel-pad stack"><h2 className="section-title">Más vendidas</h2><HBars rows={r.topProd} fmt={(v) => `${num(v)} u.`} /></section>
                  <section className="panel panel-pad stack"><h2 className="section-title">Cobrado por medio de pago</h2><HBars rows={r.topMet} /></section>
                  <section className="panel panel-pad stack"><h2 className="section-title">Por categoría</h2><HBars rows={r.topCat} /></section>
                  <section className="panel panel-pad stack"><h2 className="section-title">Por canal</h2><HBars rows={r.topCanal} /></section>
                  <section className="panel panel-pad stack"><h2 className="section-title">Talles más vendidos</h2><HBars rows={r.topTalle} fmt={(v) => `${num(v)} u.`} /></section>
                </div>
              </>
            )}
          </>
        )}

        {perdida && perdida.unidades > 0 && (
          <section className="panel panel-pad stack">
            <div className="section-head"><h2 className="section-title">Mercadería que salió sin venderse</h2><Link to="/stock/ajuste">Ver ajustes</Link></div>
            <p className="subtle">{perdida.unidades} {perdida.unidades === 1 ? 'prenda' : 'prendas'} en el período, {money(perdida.costo)} a costo.</p>
            <HBars rows={perdida.por} />
          </section>
        )}

        <section className="panel panel-pad stack">
          <div className="section-head">
            <h2 className="section-title">Prendas quietas</h2>
            {listaQuietas.length > 0 && <Link to="/stock?filtro=quietas">Ver todas</Link>}
          </div>
          {listaQuietas.length ? (
            <>
              <p className="subtle">{listaQuietas.length} {listaQuietas.length === 1 ? 'prenda lleva' : 'prendas llevan'} más de {diasQuieta} días sin venderse, con {money(plataQuieta)} invertidos. Buenas candidatas para una promo o liquidación.</p>
              <div className="list">
                {listaQuietas.slice(0, 6).map((x) => (
                  <Link key={x.id} to={`/stock/${x.id}`} className="list-item">
                    <span className="line-thumb" style={{ width: 40, height: 50 }}><ProductImg producto={x} /></span>
                    <span className="grow" style={{ minWidth: 0 }}><span className="title ellipsis" style={{ display: 'block' }}>{x.nombre}</span><span className="subtle">{x.vendida ? `Última venta hace ${x.dias} días` : `Sin ventas desde que la cargaste (${x.dias} días)`}</span></span>
                    <span className="badge badge-warn num">{x.stock} u.</span>
                  </Link>
                ))}
              </div>
            </>
          ) : <p className="muted">Todo lo que tenés en stock se vendió en los últimos {diasQuieta} días.</p>}
        </section>
      </div>
    </Page>
  )
}
