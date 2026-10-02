import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, X, PackagePlus } from 'lucide-react'
import { db, METODOS, registrarIngreso } from '../db'
import { Page } from '../layout'
import { MoneyInput, ProductImg, useToast } from '../ui'
import { money, colorHex, fechaRelativa } from '../utils'

/** Entró mercadería: suma stock por talle/color, actualiza el costo y anota el gasto, todo de una. */
export default function Ingreso() {
  const toast = useToast()
  const data = useLiveQuery(async () => {
    const [productos, variantes, ingresos] = await Promise.all([db.productos.toArray(), db.variantes.toArray(), db.ingresos.orderBy('fecha').reverse().limit(8).toArray()])
    const by = {}
    variantes.forEach((v) => { (by[v.productoId] ||= []).push(v) })
    return { productos: productos.map((p) => ({ ...p, variantes: by[p.id] || [] })).sort((a, b) => a.nombre.localeCompare(b.nombre)), ingresos }
  }, [])
  const [q, setQ] = useState('')
  const [lineas, setLineas] = useState({}) // { productoId: { costo, cant: { varianteId: n } } }
  const [proveedor, setProveedor] = useState('')
  const [anotarGasto, setAnotarGasto] = useState(true)
  const [metodo, setMetodo] = useState('transferencia')
  const [busy, setBusy] = useState(false)

  const prodMap = useMemo(() => Object.fromEntries((data?.productos || []).map((p) => [p.id, p])), [data])
  const t = q.trim().toLowerCase()
  const resultados = t ? (data?.productos || []).filter((p) => !lineas[p.id] && p.nombre.toLowerCase().includes(t)).slice(0, 6) : []

  const agregar = (p) => { setLineas({ ...lineas, [p.id]: { costo: p.costo || '', cant: {} } }); setQ('') }
  const quitar = (pid) => { const n = { ...lineas }; delete n[pid]; setLineas(n) }
  const setCant = (pid, vid, n) => setLineas({ ...lineas, [pid]: { ...lineas[pid], cant: { ...lineas[pid].cant, [vid]: n } } })
  const setCosto = (pid, c) => setLineas({ ...lineas, [pid]: { ...lineas[pid], costo: c } })

  const items = Object.entries(lineas).flatMap(([pid, l]) => Object.entries(l.cant)
    .filter(([, n]) => Number(n) > 0)
    .map(([vid, n]) => ({ productoId: Number(pid), varianteId: Number(vid), cantidad: Number(n), costo: Number(l.costo) || 0 })))
  const unidades = items.reduce((s, i) => s + i.cantidad, 0)
  const total = items.reduce((s, i) => s + i.cantidad * i.costo, 0)

  const guardar = async () => {
    setBusy(true)
    try {
      await registrarIngreso({ proveedor, items, gastoMetodo: anotarGasto ? metodo : null })
      toast(`Entraron ${unidades} prendas al stock`)
      setLineas({}); setProveedor('')
    } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }

  if (!data) return <Page title="Entró mercadería" back="/stock" />

  return (
    <Page title="Entró mercadería" back="/stock">
      <div className="stack-lg" style={{ maxWidth: 680, margin: '0 auto' }}>
        <label className="field"><span>Proveedor (opcional)</span><input className="input" placeholder="Ej: Flores, Avellaneda" value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></label>

        <section className="stack">
          <label className="search"><Search /><span className="sr-only">Buscar prenda</span><input className="input" type="search" placeholder="Buscá la prenda que entró…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {resultados.length > 0 && (
            <div className="list">
              {resultados.map((p) => (
                <button key={p.id} className="list-item" onClick={() => agregar(p)}>
                  <span className="line-thumb" style={{ width: 36, height: 45 }}><ProductImg producto={p} /></span>
                  <span className="grow">{p.nombre}<br /><span className="subtle">{p.categoria}</span></span>
                  <Plus />
                </button>
              ))}
            </div>
          )}
          {t && !resultados.length && <p className="subtle">No hay prendas con ese nombre. ¿Es nueva? <Link to="/stock/nuevo">Cargala acá</Link> y después volvé.</p>}
        </section>

        {Object.keys(lineas).map((pid) => {
          const p = prodMap[pid]
          if (!p) return null
          const l = lineas[pid]
          const colores = [...new Set(p.variantes.map((v) => v.color || ''))]
          return (
            <section key={pid} className="panel panel-pad stack">
              <div className="row-between">
                <b>{p.nombre}</b>
                <button className="icon-btn" onClick={() => quitar(pid)} aria-label={`Quitar ${p.nombre}`}><X /></button>
              </div>
              <label className="field"><span>Costo por unidad{p.costo && Number(l.costo) !== p.costo ? ` (antes ${money(p.costo)})` : ''}</span><MoneyInput value={l.costo} onChange={(v) => setCosto(pid, v)} /></label>
              {!p.variantes.length && <p className="subtle">Esta prenda no tiene talles cargados. <Link to={`/stock/${p.id}`}>Editala</Link> para agregarlos.</p>}
              {colores.map((c) => (
                <div key={c || 'u'} className="stack" style={{ gap: 6 }}>
                  {c && <div className="row" style={{ gap: 8 }}><span className="color-dot" style={{ background: colorHex(c) }} /><b>{c}</b></div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 10 }}>
                    {p.variantes.filter((v) => (v.color || '') === c).map((v) => (
                      <label key={v.id} className="field" style={{ gap: 4 }}>
                        <span style={{ textAlign: 'center' }}>{v.talle} <span className="subtle">({v.stock})</span></span>
                        <input className="input num" style={{ textAlign: 'center' }} inputMode="numeric" placeholder="+0" value={l.cant[v.id] ?? ''}
                          onChange={(e) => setCant(pid, v.id, e.target.value.replace(/\D/g, ''))} aria-label={`Unidades que entraron de ${p.nombre} talle ${v.talle}${c ? ' ' + c : ''}`} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )
        })}

        {Object.keys(lineas).length > 0 && (
          <section className="stack">
            <label className="row"><input type="checkbox" checked={anotarGasto} onChange={(e) => setAnotarGasto(e.target.checked)} /> Anotar el gasto de mercadería ({money(total)})</label>
            {anotarGasto && (
              <label className="field"><span>Lo pagaste con</span>
                <select className="select" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
              </label>
            )}
            <button className="btn btn-primary btn-lg btn-block" disabled={!unidades || busy} onClick={guardar}>
              <PackagePlus /> Sumar {unidades} {unidades === 1 ? 'prenda' : 'prendas'} al stock
            </button>
          </section>
        )}

        {!Object.keys(lineas).length && (
          <section className="stack">
            <h2 className="section-title">Últimos ingresos</h2>
            {data.ingresos.length ? (
              <div className="list">
                {data.ingresos.map((i) => (
                  <div key={i.id} className="list-item">
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="title">{i.proveedor || 'Ingreso de mercadería'}</span><br />
                      <span className="subtle">{fechaRelativa(i.fecha)} · {i.items.reduce((s, x) => s + x.cantidad, 0)} prendas{i.gastoId ? '' : ' · sin gasto anotado'}</span>
                    </span>
                    <b className="money">{money(i.total)}</b>
                  </div>
                ))}
              </div>
            ) : <p className="muted">Cuando entre mercadería, buscá la prenda y cargá cuántas llegaron de cada talle.</p>}
          </section>
        )}
      </div>
    </Page>
  )
}
