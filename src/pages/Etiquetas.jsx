import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import QRCode from 'qrcode'
import { Printer, Search } from 'lucide-react'
import { db } from '../db'
import { useConfig } from '../store'
import { Page } from '../layout'
import { Empty } from '../ui'
import { moneyTxt, codigoVariante } from '../utils'

/** Etiquetas colgantes con QR para imprimir. El QR abre la app y suma la prenda al carrito. */
export default function Etiquetas() {
  const cfg = useConfig()
  const [sp] = useSearchParams()
  const soloProd = Number(sp.get('p')) || null
  const data = useLiveQuery(async () => {
    const [productos, variantes] = await Promise.all([db.productos.toArray(), db.variantes.toArray()])
    const by = {}
    variantes.forEach((v) => { (by[v.productoId] ||= []).push(v) })
    return productos.filter((p) => p.activo !== 0).map((p) => ({ ...p, variantes: by[p.id] || [] })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [])
  const [q, setQ] = useState('')
  const [cant, setCant] = useState({}) // { varianteId: n }
  const [qrs, setQrs] = useState({})

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data || []).filter((p) => (!soloProd || p.id === soloProd) && (!t || p.nombre.toLowerCase().includes(t)))
  }, [data, q, soloProd])

  const etiquetas = useMemo(() => {
    const out = []
    ;(data || []).forEach((p) => p.variantes.forEach((v) => { for (let i = 0; i < (Number(cant[v.id]) || 0); i++) out.push({ key: `${v.id}-${i}`, p, v }) }))
    return out
  }, [data, cant])

  // Genera los QR que falten (una vez por variante).
  const faltan = [...new Set(etiquetas.map((e) => e.v.id))].filter((vid) => !qrs[vid])
  const faltanKey = faltan.join(',')
  useEffect(() => {
    if (!faltanKey) return
    let vivo = true
    Promise.all(faltanKey.split(',').map(async (vid) => [vid, await QRCode.toString(codigoVariante(vid), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })]))
      .then((pares) => { if (vivo) setQrs((prev) => ({ ...prev, ...Object.fromEntries(pares) })) })
    return () => { vivo = false }
  }, [faltanKey])

  const todas = (modo) => {
    const n = {}
    lista.forEach((p) => p.variantes.forEach((v) => { n[v.id] = modo === 'stock' ? v.stock : modo === 'una' ? 1 : 0 }))
    setCant({ ...cant, ...n })
  }

  if (!data || !cfg) return <Page title="Etiquetas" back="/stock" />

  return (
    <Page title="Etiquetas con QR" back="/stock">
      <div className="stack-lg no-print">
        {/^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(location.hostname) && (
          <p className="alert alert-warn">Estás en una dirección local ({location.host}): los QR impresos desde acá no van a abrir la app en otro celular. Imprimí las etiquetas desde la app publicada.</p>
        )}
        <p className="muted">Elegí cuántas etiquetas imprimir de cada talle. Al escanear el QR con el celular se abre la app y la prenda va directo al carrito.</p>
        {!data.length ? <Empty title="No hay prendas" text="Cargá prendas para imprimir sus etiquetas." /> : (
          <>
            {!soloProd && <label className="search"><Search /><span className="sr-only">Buscar</span><input className="input" type="search" placeholder="Buscar prenda…" value={q} onChange={(e) => setQ(e.target.value)} /></label>}
            <div className="row wrap">
              <button className="btn btn-soft btn-sm" onClick={() => todas('stock')}>Una por unidad en stock</button>
              <button className="btn btn-soft btn-sm" onClick={() => todas('una')}>Una por talle</button>
              <button className="btn btn-ghost btn-sm" onClick={() => todas('cero')}>Ninguna</button>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {lista.map((p) => (
                <section key={p.id} className="panel panel-pad stack" style={{ gap: 8 }}>
                  <b>{p.nombre} <span className="subtle">· {moneyTxt(p.precio)}</span></b>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
                    {p.variantes.map((v) => (
                      <label key={v.id} className="field" style={{ gap: 4 }}>
                        <span style={{ textAlign: 'center' }}>{v.talle}{v.color ? ` · ${v.color}` : ''}</span>
                        <input className="input num" style={{ textAlign: 'center' }} inputMode="numeric" placeholder="0" value={cant[v.id] ?? ''}
                          onChange={(e) => setCant({ ...cant, [v.id]: e.target.value.replace(/\D/g, '').slice(0, 3) })} aria-label={`Etiquetas de ${p.nombre} talle ${v.talle}`} />
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <button className="btn btn-primary btn-lg btn-block" disabled={!etiquetas.length || faltan.length > 0} onClick={() => window.print()}>
              <Printer /> Imprimir {etiquetas.length} {etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'}
            </button>
            <p className="subtle">Tip: en el diálogo de impresión podés elegir “Guardar como PDF” y mandarlo a imprimir en una librería.</p>
          </>
        )}
      </div>

      {etiquetas.length > 0 && (
        <div className="print-area" aria-label="Vista previa de etiquetas">
          {etiquetas.map(({ key, p, v }) => (
            <div key={key} className="hangtag">
              <span className="hangtag-hole" aria-hidden="true" />
              <p className="hangtag-brand">{cfg.tienda}</p>
              <p className="hangtag-name">{p.nombre}</p>
              <p className="hangtag-size">{v.talle}{v.color ? ` · ${v.color}` : ''}</p>
              <div className="hangtag-qr" dangerouslySetInnerHTML={{ __html: qrs[v.id] || '' }} />
              <p className="hangtag-price">{moneyTxt(p.precio)}</p>
              <p className="hangtag-code">V{v.id}</p>
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}
