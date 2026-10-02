import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, X, ClipboardCheck } from 'lucide-react'
import { db, ajustarStock, MOTIVOS_AJUSTE, MOTIVO_AJUSTE_LABEL } from '../db'
import { Page } from '../layout'
import { ProductImg, useToast } from '../ui'
import { money, colorHex, fechaRelativa } from '../utils'

/** Ajustar stock con motivo: fallas, robos, conteos. Queda registrado y se ve en Reportes. */
export default function Ajuste() {
  const toast = useToast()
  const [sp] = useSearchParams()
  const inicial = Number(sp.get('p')) || null
  const data = useLiveQuery(async () => {
    const [productos, variantes, ajustes] = await Promise.all([db.productos.toArray(), db.variantes.toArray(), db.ajustes.orderBy('fecha').reverse().limit(15).toArray()])
    const by = {}
    variantes.forEach((v) => { (by[v.productoId] ||= []).push(v) })
    return { productos: productos.map((p) => ({ ...p, variantes: by[p.id] || [] })).sort((a, b) => a.nombre.localeCompare(b.nombre)), ajustes }
  }, [])
  const [q, setQ] = useState('')
  const [elegidos, setElegidos] = useState(() => (inicial ? [inicial] : []))
  const [delta, setDelta] = useState({}) // { varianteId: '-2' | '3' }
  const [motivo, setMotivo] = useState('falla')
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)

  const info = MOTIVOS_AJUSTE.find((m) => m.id === motivo)
  const prodMap = useMemo(() => Object.fromEntries((data?.productos || []).map((p) => [p.id, p])), [data])
  const t = q.trim().toLowerCase()
  const resultados = t ? (data?.productos || []).filter((p) => !elegidos.includes(p.id) && p.nombre.toLowerCase().includes(t)).slice(0, 6) : []

  // En motivos que solo restan (falla, pérdida, uso) se escribe la cantidad que sale; en el resto, + o −.
  const valor = (vid) => {
    const n = parseInt(delta[vid], 10)
    if (!n) return 0
    return info.signo < 0 ? -Math.abs(n) : n
  }
  const items = elegidos.flatMap((pid) => (prodMap[pid]?.variantes || []).map((v) => ({ varianteId: v.id, delta: valor(v.id), costo: prodMap[pid].costo || 0 }))).filter((i) => i.delta)
  const unidades = items.reduce((s, i) => s + i.delta, 0)
  const costo = items.reduce((s, i) => s + i.delta * i.costo, 0)

  const guardar = async () => {
    setBusy(true)
    try {
      await ajustarStock({ items, motivo, nota })
      toast('Stock ajustado')
      setElegidos([]); setDelta({}); setNota('')
    } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }

  if (!data) return <Page title="Ajustar stock" back="/stock" />

  return (
    <Page title="Ajustar stock" back="/stock">
      <div className="stack-lg" style={{ maxWidth: 680, margin: '0 auto' }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Motivo</span>
          <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }} role="group" aria-label="Motivo del ajuste">
            {MOTIVOS_AJUSTE.map((m) => <button key={m.id} className="chip" aria-pressed={motivo === m.id} onClick={() => setMotivo(m.id)}>{m.label}</button>)}
          </div>
          <p className="subtle">{info.signo < 0 ? 'Escribí cuántas unidades salen del stock.' : 'Escribí cuánto cambia: 2 suma dos, -2 saca dos.'}</p>
        </div>

        <section className="stack">
          <label className="search"><Search /><span className="sr-only">Buscar prenda</span><input className="input" type="search" placeholder="Buscá la prenda…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {resultados.length > 0 && (
            <div className="list">
              {resultados.map((p) => (
                <button key={p.id} className="list-item" onClick={() => { setElegidos([...elegidos, p.id]); setQ('') }}>
                  <span className="line-thumb" style={{ width: 36, height: 45 }}><ProductImg producto={p} /></span>
                  <span className="grow">{p.nombre}<br /><span className="subtle">{p.variantes.reduce((s, v) => s + v.stock, 0)} u. en stock</span></span>
                  <Plus />
                </button>
              ))}
            </div>
          )}
        </section>

        {elegidos.map((pid) => {
          const p = prodMap[pid]
          if (!p) return null
          const colores = [...new Set(p.variantes.map((v) => v.color || ''))]
          return (
            <section key={pid} className="panel panel-pad stack">
              <div className="row-between"><b>{p.nombre}</b><button className="icon-btn" onClick={() => setElegidos(elegidos.filter((x) => x !== pid))} aria-label={`Quitar ${p.nombre}`}><X /></button></div>
              {colores.map((c) => (
                <div key={c || 'u'} className="stack" style={{ gap: 6 }}>
                  {c && <div className="row" style={{ gap: 8 }}><span className="color-dot" style={{ background: colorHex(c) }} /><b>{c}</b></div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 10 }}>
                    {p.variantes.filter((v) => (v.color || '') === c).map((v) => (
                      <label key={v.id} className="field" style={{ gap: 4 }}>
                        <span style={{ textAlign: 'center' }}>{v.talle} <span className="subtle">({v.stock})</span></span>
                        <input className="input num" style={{ textAlign: 'center' }} inputMode={info.signo < 0 ? 'numeric' : 'text'} placeholder="0" value={delta[v.id] ?? ''}
                          onChange={(e) => setDelta({ ...delta, [v.id]: e.target.value.replace(info.signo < 0 ? /\D/g : /[^\d-]/g, '').slice(0, 4) })}
                          aria-label={`Ajuste de ${p.nombre} talle ${v.talle}${c ? ' ' + c : ''}`} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )
        })}

        {elegidos.length > 0 && (
          <section className="stack">
            <label className="field"><span>Nota (opcional)</span><input className="input" placeholder="Ej: mancha que no sale, se la llevó el proveedor…" value={nota} onChange={(e) => setNota(e.target.value)} /></label>
            {items.length > 0 && <p className="muted">{unidades < 0 ? `Salen ${-unidades}` : `Entran ${unidades}`} {Math.abs(unidades) === 1 ? 'unidad' : 'unidades'}{costo < 0 ? ` · ${money(-costo)} a costo` : ''}.</p>}
            <button className="btn btn-primary btn-lg btn-block" disabled={!items.length || busy} onClick={guardar}><ClipboardCheck /> Guardar ajuste</button>
          </section>
        )}

        {!elegidos.length && (
          <section className="stack">
            <h2 className="section-title">Últimos ajustes</h2>
            {data.ajustes.length ? (
              <div className="list">
                {data.ajustes.map((a) => (
                  <Link key={a.id} to={`/stock/${a.productoId}`} className="list-item">
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="title ellipsis" style={{ display: 'block' }}>{a.nombre} ({a.talle}{a.color ? ` · ${a.color}` : ''})</span>
                      <span className="subtle">{fechaRelativa(a.fecha)} · {MOTIVO_AJUSTE_LABEL[a.motivo] || a.motivo}{a.nota ? ` · ${a.nota}` : ''}</span>
                    </span>
                    <span className={`badge ${a.delta < 0 ? 'badge-bad' : 'badge-ok'} num`}>{a.delta > 0 ? '+' : ''}{a.delta}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="muted">Cuando una prenda se rompe, se pierde o el conteo no coincide, ajustala acá: queda registrado el motivo.</p>}
          </section>
        )}
      </div>
    </Page>
  )
}
