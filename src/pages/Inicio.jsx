import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { HandCoins, MinusCircle, Wallet, ChevronRight, DatabaseBackup, Cake, PackagePlus, Store } from 'lucide-react'
import { db, METODO_LABEL, deudaPorClienta } from '../db'
import { useConfig } from '../store'
import { useHoy, useAhora } from '../hooks'
import { Page } from '../layout'
import { Tag } from '../ui'
import { EsperasBar } from './Vender'
import { money, fechaLarga, hora, initials, diasParaCumple, DIA } from '../utils'

const SPLIT_COLORS = { efectivo: '#ffffff', transferencia: '#f8cfe0', debito: '#f3a6c6', credito: '#dd4d88' }

export default function Inicio() {
  const cfg = useConfig()
  const { desde, hasta } = useHoy()
  const ahora = useAhora()

  const data = useLiveQuery(async () => {
    const [ventas, cobros, gastos, variantes, deudas, clientas, devoluciones] = await Promise.all([
      db.ventas.where('fecha').between(desde, hasta, true, true).toArray(),
      db.cobros.where('fecha').between(desde, hasta, true, true).toArray(),
      db.gastos.where('fecha').between(desde, hasta, true, true).toArray(),
      db.variantes.toArray(),
      deudaPorClienta(),
      db.clientas.toArray(),
      db.devoluciones.where('fecha').between(desde, hasta, true, true).toArray(),
    ])
    const activas = ventas.filter((v) => !v.anulada)
    const contables = ventas.filter((v) => !v.anulada || v.porDevolucion)
    const porMetodo = {}
    cobros.forEach((c) => { porMetodo[c.metodo] = (porMetodo[c.metodo] || 0) + c.monto })
    const cobrado = cobros.reduce((s, c) => s + c.monto, 0)
    const devuelto = devoluciones.reduce((s, d) => s + d.valor, 0)
    const vendido = contables.reduce((s, v) => s + v.total, 0) - devuelto
    const unidades = activas.reduce((s, v) => s + v.items.reduce((a, i) => a + i.cantidad, 0), 0)
    const totalDeuda = Object.values(deudas).reduce((s, n) => s + n, 0)
    const deudoras = Object.keys(deudas).length
    const umbral = cfg?.stockBajo ?? 2
    const bajo = variantes.filter((v) => v.stock <= umbral).length
    const gastado = gastos.reduce((s, g) => s + g.monto, 0)
    const cMap = Object.fromEntries(clientas.map((c) => [c.id, c]))
    const ultimas = [...activas].sort((a, b) => b.fecha - a.fecha).slice(0, 5).map((v) => ({ ...v, clienta: cMap[v.clientaId] }))
    const cumples = clientas.map((c) => ({ ...c, faltan: diasParaCumple(c.cumple, new Date(desde)) })).filter((c) => c.faltan !== null && c.faltan <= 3).sort((a, b) => a.faltan - b.faltan)
    return { cobrado, vendido, devuelto, cant: activas.length, unidades, porMetodo, totalDeuda, deudoras, bajo, gastado, ultimas, cumples }
  }, [desde, hasta, cfg?.stockBajo])

  if (!data || !cfg) return <Page title="Inicio" home />

  const meta = cfg.metaDiaria || 0
  const pct = meta ? Math.min(100, (data.vendido / meta) * 100) : 0
  const metodos = Object.entries(data.porMetodo).filter(([, v]) => v > 0)
  const totalBarra = metodos.reduce((s, [, v]) => s + v, 0)
  const diasBackup = cfg.ultimoBackup ? Math.floor((ahora - cfg.ultimoBackup) / DIA) : null
  const pedirBackup = diasBackup === null || diasBackup >= 7

  return (
    <Page title="Inicio" home>
      <div className="stack-lg">
        <div className="home-grid">
        <div className="stack">
          <p className="muted" style={{ fontWeight: 600 }}>{fechaLarga(desde)}</p>
          <Tag rose string className="today">
            <p className="today-label">Vendido hoy</p>
            <p className="today-total money">{money(data.vendido)}</p>
            <div className="today-meta">
              <span><b className="num">{data.cant}</b>{data.cant === 1 ? 'venta' : 'ventas'}</span>
              <span><b className="num">{data.unidades}</b>prendas</span>
              <span><b className="money">{money(data.cant ? data.vendido / data.cant : 0)}</b>ticket prom.</span>
            </div>
            {data.devuelto > 0 && <p className="today-label" style={{ marginTop: 6 }}>Ya descontadas devoluciones por {money(data.devuelto)}</p>}
            {meta > 0 && (
              <div className="goal" aria-label={`Meta del día: ${Math.round(pct)}%`}>
                <div className="goal-track"><div className="goal-ticks" /><div className="goal-fill" style={{ transform: `scaleX(${pct / 100})` }} /></div>
                <div className="goal-row"><span>Meta del día</span><span className="num">{Math.round(pct)}% de {money(meta)}</span></div>
              </div>
            )}
            <div className="perforation" aria-hidden="true" />
            <p className="today-label" style={{ marginBottom: 8 }}>Entró en caja · {money(data.cobrado)}</p>
            {metodos.length ? (
              <>
                <div className="split-bar" aria-hidden="true">
                  {metodos.map(([m, v]) => <span key={m} style={{ width: `${(v / totalBarra) * 100}%`, background: SPLIT_COLORS[m] }} />)}
                </div>
                <div className="split">
                  {metodos.map(([m, v]) => (
                    <div className="split-item" key={m}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SPLIT_COLORS[m], marginRight: 6 }} />
                      {METODO_LABEL[m]}<b>{money(v)}</b>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="split-item">Todavía no entró plata hoy. La primera venta del día se anota con el botón Vender.</p>}
          </Tag>
        </div>

        <div className="home-side">
        <div className="stat-strip">
          <Link to="/clientas?filtro=deben" className={`stat ${data.totalDeuda > 0 ? 'bad' : ''}`}>
            <span className="k">Te deben</span>
            <span className="v">{money(data.totalDeuda)}</span>
            <span className="subtle">{data.deudoras} {data.deudoras === 1 ? 'clienta' : 'clientas'}</span>
          </Link>
          <Link to="/stock?filtro=bajo" className={`stat ${data.bajo > 0 ? 'warn' : ''}`}>
            <span className="k">Stock bajo</span>
            <span className="v num">{data.bajo}</span>
            <span className="subtle">talles por reponer</span>
          </Link>
          <Link to="/caja" className="stat">
            <span className="k">Gastos hoy</span>
            <span className="v">{money(data.gastado)}</span>
            <span className="subtle">ver caja</span>
          </Link>
        </div>

        <EsperasBar />

        {data.cumples.length > 0 && (
          <Link to="/clientas?filtro=cumple" className="alert alert-rose" style={{ textDecoration: 'none' }}>
            <Cake />
            <span className="grow">
              {data.cumples.map((c) => `${c.nombre.split(' ')[0]} ${c.faltan === 0 ? 'cumple hoy' : c.faltan === 1 ? 'cumple mañana' : `cumple en ${c.faltan} días`}`).join(' · ')}. Mandale un saludo.
            </span>
            <ChevronRight />
          </Link>
        )}

        {pedirBackup && (
          <Link to="/ajustes" className="alert alert-warn" style={{ textDecoration: 'none' }}>
            <DatabaseBackup />
            <span className="grow">
              <b>{diasBackup === null ? 'Todavía no hiciste un backup.' : `Último backup hace ${diasBackup} días.`}</b> Si el celular se pierde o se borra, los datos se van con él. Mandátelo por WhatsApp o guardalo en Drive en un minuto.
            </span>
            <ChevronRight />
          </Link>
        )}

        <div className="quick">
          <Link to="/clientas?filtro=deben"><HandCoins />Cobrar deuda</Link>
          <Link to="/caja?gasto=1"><MinusCircle />Anotar gasto</Link>
          <Link to="/caja"><Wallet />Cerrar caja</Link>
          <Link to="/stock/ingreso"><PackagePlus />Entró mercadería</Link>
        </div>
        </div>
        </div>

        <section className="stack">
          <div className="section-head"><h2 className="section-title">Últimas ventas de hoy</h2><Link to="/ventas">Ver todas</Link></div>
          {data.ultimas.length ? (
            <div className="list">
              {data.ultimas.map((v) => (
                <Link key={v.id} to={`/ventas/${v.id}`} className="list-item">
                  <span className="avatar">{v.clienta ? initials(v.clienta.nombre) : <Store size={18} />}</span>
                  <span className="grow">
                    <span className="title ellipsis" style={{ display: 'block' }}>{v.items.map((i) => i.nombre).join(', ')}</span>
                    <span className="subtle">{hora(v.fecha)} · {v.clienta?.nombre || 'Mostrador'} · {v.pagos.map((p) => METODO_LABEL[p.metodo]).join(' + ')}</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <b className="money">{money(v.total)}</b>
                    {v.saldo > 0 && <><br /><span className="badge badge-bad">debe {money(v.saldo)}</span></>}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="panel panel-pad muted">Cuando vendas algo hoy, va a aparecer acá.</div>
          )}
        </section>
      </div>
    </Page>
  )
}
