import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, TrendingUp, PackagePlus, QrCode, ClipboardCheck } from 'lucide-react'
import { db } from '../db'
import { useConfig } from '../store'
import { useAhora, useUltimaVentaPorProducto } from '../hooks'
import { Page } from '../layout'
import { Rack, ProductImg, Empty, EmptyRackArt } from '../ui'
import { money, colorHex, diasDesde } from '../utils'

export default function Stock() {
  const cfg = useConfig()
  const [sp, setSp] = useSearchParams()
  const filtro = sp.get('filtro') || 'todas'
  const [q, setQ] = useState('')
  const umbral = cfg?.stockBajo ?? 2
  const diasQuieta = cfg?.diasQuieta || 60
  const ultimaVenta = useUltimaVentaPorProducto()
  const ahora = useAhora()
  /** Días sin venderse (desde la última venta o desde que se cargó). */
  const diasSinVenta = (p) => { const t = ultimaVenta?.[p.id] || p.creado; return t ? diasDesde(t, ahora) : null }

  const productos = useLiveQuery(async () => {
    const [ps, vs] = await Promise.all([db.productos.toArray(), db.variantes.toArray()])
    const by = {}
    vs.forEach((v) => { (by[v.productoId] ||= []).push(v) })
    return ps.map((p) => ({ ...p, variantes: by[p.id] || [] })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [])

  const lista = useMemo(() => {
    if (!productos) return []
    const t = q.trim().toLowerCase()
    return productos.filter((p) => {
      if (t && !p.nombre.toLowerCase().includes(t)) return false
      const total = p.variantes.reduce((s, v) => s + v.stock, 0)
      if (filtro === 'bajo') return p.activo !== 0 && p.variantes.some((v) => v.stock <= umbral)
      if (filtro === 'agotadas') return p.activo !== 0 && total === 0
      if (filtro === 'ocultas') return p.activo === 0
      if (filtro === 'quietas') return p.activo !== 0 && total > 0 && (diasSinVenta(p) ?? 0) >= diasQuieta
      return p.activo !== 0
    })
  }, [productos, q, filtro, umbral, diasQuieta, ultimaVenta, ahora]) // eslint-disable-line react-hooks/exhaustive-deps

  const resumen = useMemo(() => {
    if (!productos) return null
    const act = productos.filter((p) => p.activo !== 0)
    const unidades = act.reduce((s, p) => s + p.variantes.reduce((a, v) => a + v.stock, 0), 0)
    const valor = act.reduce((s, p) => s + p.variantes.reduce((a, v) => a + v.stock, 0) * (p.costo || 0), 0)
    const venta = act.reduce((s, p) => s + p.variantes.reduce((a, v) => a + v.stock, 0) * p.precio, 0)
    return { unidades, valor, venta }
  }, [productos])

  return (
    <Page title="Stock" actions={<Link to="/stock/nuevo" className="btn btn-sm btn-soft" style={{ background: '#fff' }}><Plus /> Prenda</Link>}>
      <div className="stack">
        {resumen && (
          <div className="stat-strip">
            <div className="stat"><span className="k">Prendas en stock</span><span className="v num">{resumen.unidades}</span></div>
            <div className="stat"><span className="k">Costo invertido</span><span className="v">{money(resumen.valor)}</span></div>
            <div className="stat"><span className="k">A precio venta</span><span className="v">{money(resumen.venta)}</span></div>
          </div>
        )}
        <div className="row wrap">
          <Link to="/stock/ingreso" className="btn btn-soft btn-sm"><PackagePlus /> Entró mercadería</Link>
          <Link to="/stock/ajuste" className="btn btn-soft btn-sm"><ClipboardCheck /> Ajustar stock</Link>
          <Link to="/stock/precios" className="btn btn-soft btn-sm"><TrendingUp /> Actualizar precios</Link>
          <Link to="/stock/etiquetas" className="btn btn-soft btn-sm"><QrCode /> Etiquetas</Link>
        </div>
        <label className="search"><Search /><span className="sr-only">Buscar</span><input className="input" type="search" placeholder="Buscar prenda…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="chips" role="group" aria-label="Filtro de stock">
          {[['todas', 'Todas'], ['bajo', 'Stock bajo'], ['agotadas', 'Agotadas'], ['quietas', `Quietas +${diasQuieta} días`], ['ocultas', 'Ocultas']].map(([id, l]) => (
            <button key={id} className="chip" aria-pressed={filtro === id} onClick={() => setSp(id === 'todas' ? {} : { filtro: id }, { replace: true })}>{l}</button>
          ))}
        </div>

        {productos && !productos.length ? (
          <Empty art={<EmptyRackArt />} title="Todavía no cargaste prendas" text="Cada prenda lleva sus talles y colores. El stock se descuenta solo cuando vendés." action={<Link className="btn btn-primary" to="/stock/nuevo"><Plus /> Cargar primera prenda</Link>} />
        ) : productos && !lista.length ? (
          <Empty
            title={filtro === 'bajo' ? 'Nada por reponer' : filtro === 'quietas' ? 'No hay prendas quietas' : 'Sin resultados'}
            text={filtro === 'bajo' ? `Todos los talles tienen más de ${umbral} unidades.` : filtro === 'quietas' ? `Todo lo que tenés se vendió en los últimos ${diasQuieta} días.` : 'Probá con otra búsqueda o filtro.'} />
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {lista.map((p) => {
              const colores = [...new Set(p.variantes.map((v) => v.color || ''))]
              const total = p.variantes.reduce((s, v) => s + v.stock, 0)
              return (
                <Link key={p.id} to={`/stock/${p.id}`} className="panel panel-pad" style={{ display: 'flex', gap: 12, textDecoration: 'none', color: 'inherit' }}>
                  <div className="line-thumb" style={{ width: 56, height: 70 }}><ProductImg producto={p} /></div>
                  <div className="grow stack" style={{ gap: 8 }}>
                    <div className="row-between" style={{ alignItems: 'flex-start' }}>
                      <span><b>{p.nombre}</b><br /><span className="subtle">{p.categoria} · {money(p.precio)}</span>
                        {filtro === 'quietas' && <><br /><span className="badge badge-warn">{ultimaVenta?.[p.id] ? `sin ventas hace ${diasSinVenta(p)} días` : `nunca se vendió (${diasSinVenta(p)} días)`}</span></>}</span>
                      {total === 0 ? <span className="badge badge-bad">agotada</span> : <span className="badge badge-rose num">{total} u.</span>}
                    </div>
                    {colores.map((c) => (
                      <div key={c} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                        {c && <span className="color-dot" style={{ background: colorHex(c), marginTop: 4 }} title={c} />}
                        <div className="grow" style={{ minWidth: 0 }}>
                          <Rack mini stockBajo={umbral} label={`Talles ${c}`} items={p.variantes.filter((v) => (v.color || '') === c).map((v) => ({ key: v.id, talle: v.talle, color: v.color, stock: v.stock }))} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </Page>
  )
}
