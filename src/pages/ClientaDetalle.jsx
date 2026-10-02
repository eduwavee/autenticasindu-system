import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { MessageCircle, HandCoins, Pencil, Trash2, AtSign, PiggyBank, ArrowLeftRight, Undo2, Cake, Sparkles } from 'lucide-react'
import { db, cobrarDeuda, cargarSaldoAFavor, compensarDeudaConSaldo, devolverSaldoAFavor, saldoAFavor, METODOS, METODO_LABEL } from '../db'
import { useConfig } from '../store'
import { useAhora } from '../hooks'
import { Page } from '../layout'
import { Tag, Sheet, Confirm, MoneyInput, useToast } from '../ui'
import { money, fechaRelativa, waLink, initials, diasDesde, diasParaCumple, textoCumpleCorto } from '../utils'
import { textoRecordatorio, textoNovedades, textoCumple } from '../textos'
import { ClientaForm } from './Clientas'

/** Hoja para mover plata: cobrar deuda, cargar seña o devolver saldo. */
function MontoSheet({ titulo, ayuda, inicial = '', boton, onConfirm, onClose, extra }) {
  const toast = useToast()
  const [monto, setMonto] = useState(inicial)
  const [metodo, setMetodo] = useState('efectivo')
  const [busy, setBusy] = useState(false)
  const ok = Number(monto) > 0
  const confirmar = async () => {
    setBusy(true)
    try { await onConfirm(Number(monto), metodo); onClose() } catch (e) { toast(e.message, 'error'); setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} title={titulo}>
      <div className="stack">
        {ayuda && <p className="muted">{ayuda}</p>}
        <label className="field"><span>Monto</span><MoneyInput value={monto} onChange={setMonto} autoFocus /></label>
        <div className="seg" role="group" aria-label="Medio de pago">
          {METODOS.map((m) => <button key={m.id} aria-pressed={metodo === m.id} onClick={() => setMetodo(m.id)}>{m.label.replace(' / MP', '')}</button>)}
        </div>
        {extra?.(Number(monto) || 0)}
        <button className="btn btn-primary btn-lg btn-block" disabled={!ok || busy} onClick={confirmar}>{boton}</button>
      </div>
    </Sheet>
  )
}

export default function ClientaDetalle() {
  const { id } = useParams()
  const cid = Number(id)
  const cfg = useConfig()
  const nav = useNavigate()
  const toast = useToast()
  const ahora = useAhora()
  const [sheet, setSheet] = useState(null) // 'cobrar' | 'senia' | 'devolver' | 'compensar' | 'editar' | 'borrar'

  const data = useLiveQuery(async () => {
    const c = await db.clientas.get(cid)
    if (!c) return { c: null }
    const [ventas, cobros, creditos, devoluciones, credito, productos, variantes] = await Promise.all([
      db.ventas.where('clientaId').equals(cid).reverse().sortBy('fecha'),
      db.cobros.where('clientaId').equals(cid).toArray(),
      db.creditos.where('clientaId').equals(cid).toArray(),
      db.devoluciones.where('clientaId').equals(cid).toArray(),
      saldoAFavor(cid),
      db.productos.toArray(),
      db.variantes.toArray(),
    ])
    const activas = ventas.filter((v) => !v.anulada)
    const deuda = activas.reduce((s, v) => s + (v.saldo || 0), 0)
    const comprado = activas.reduce((s, v) => s + v.total - (v.devuelto || 0), 0)

    // Talle habitual: el cargado en la ficha o el que más compró.
    const talles = {}
    activas.forEach((v) => v.items.forEach((i) => { const n = i.cantidad - (i.devuelto || 0); if (n > 0) talles[i.talle] = (talles[i.talle] || 0) + n }))
    const talleCompras = Object.entries(talles).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    const talle = c.talle || talleCompras

    // Novedades para ofrecerle: lo último cargado con stock en su talle.
    const conStock = new Set(variantes.filter((v) => v.stock > 0 && (!talle || v.talle === talle)).map((v) => v.productoId))
    const novedades = productos.filter((p) => p.activo !== 0 && conStock.has(p.id)).sort((a, b) => (b.creado || 0) - (a.creado || 0)).slice(0, 5)

    const mov = [
      ...activas.map((v) => ({ t: v.fecha, tipo: 'venta', v })),
      ...cobros.filter((x) => x.tipo === 'pago_cuenta').map((p) => ({ t: p.fecha, tipo: 'pago', p })),
      ...cobros.filter((x) => x.tipo === 'senia').map((p) => ({ t: p.fecha, tipo: 'senia', p })),
      ...cobros.filter((x) => x.tipo === 'reintegro' && !x.devolucionId).map((p) => ({ t: p.fecha, tipo: 'reintegro', p })),
      ...devoluciones.filter((d) => d.tipo !== 'anulacion').map((d) => ({ t: d.fecha, tipo: 'devolucion', d })),
      ...creditos.filter((x) => x.motivo === 'compensa deuda').map((x) => ({ t: x.fecha, tipo: 'compensa', x })),
    ].sort((a, b) => b.t - a.t)
    return { c, deuda, credito, comprado, compras: activas.length, ultima: activas[0]?.fecha || null, talle, talleCompras, novedades, mov }
  }, [cid])

  if (!data || !cfg) return <Page title="Clienta" back="/clientas" />
  const { c } = data
  if (!c) return <Page title="Clienta" back="/clientas"><p className="muted">No encontramos esta clienta.</p></Page>

  const nombre = c.nombre.split(' ')[0]
  const faltaCumple = diasParaCumple(c.cumple, new Date(ahora))
  const diasSinComprar = data.ultima ? diasDesde(data.ultima, ahora) : null
  const cerrar = () => setSheet(null)

  return (
    <Page title={c.nombre} back="/clientas" actions={<button className="icon-btn" onClick={() => setSheet('editar')} aria-label="Editar clienta"><Pencil /></button>}>
      <div className="stack-lg" style={{ maxWidth: 620, margin: '0 auto' }}>
        <Tag string rose={data.deuda > 0}>
          <div className="row" style={{ gap: 14 }}>
            <span className="avatar" style={{ width: 52, height: 52, fontSize: 'var(--fs-md)', ...(data.deuda > 0 ? { background: 'var(--rose-50)' } : {}) }}>{initials(c.nombre)}</span>
            <div className="grow">
              <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, opacity: 0.8 }}>{data.deuda > 0 ? 'Saldo pendiente' : data.credito > 0 ? 'Saldo a favor' : 'Cuenta al día'}</p>
              <p className="money" style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, letterSpacing: '-0.02em' }}>{money(data.deuda > 0 ? data.deuda : data.credito)}</p>
            </div>
          </div>
          {data.deuda > 0 && data.credito > 0 && <p style={{ fontSize: 'var(--fs-sm)', marginTop: 8 }}>Además tiene <b className="money">{money(data.credito)}</b> a favor.</p>}
          <div className="row" style={{ gap: 18, marginTop: 14, fontSize: 'var(--fs-sm)', opacity: 0.9 }}>
            <span><b className="num">{data.compras}</b> compras</span>
            <span><b className="money">{money(data.comprado)}</b> en total</span>
          </div>
        </Tag>

        <div className="grid-2">
          {data.deuda > 0 ? (
            <button className="btn btn-primary" onClick={() => setSheet('cobrar')}><HandCoins /> Cobrar</button>
          ) : <Link className="btn btn-primary" to="/vender">Nueva venta</Link>}
          {c.telefono ? (
            <a className="btn btn-wa" href={waLink(c.telefono, data.deuda > 0 ? textoRecordatorio(c, data.deuda, cfg) : `Hola ${nombre}! 💗`)} target="_blank" rel="noreferrer"><MessageCircle /> {data.deuda > 0 ? 'Recordar' : 'WhatsApp'}</a>
          ) : c.instagram ? (
            <a className="btn btn-ghost" href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noreferrer"><AtSign /> {c.instagram}</a>
          ) : <button className="btn btn-ghost" onClick={() => setSheet('editar')}>Agregar WhatsApp</button>}
        </div>

        <div className="row wrap">
          <button className="btn btn-soft btn-sm" onClick={() => setSheet('senia')}><PiggyBank /> Cargar seña</button>
          {data.credito > 0 && data.deuda > 0 && <button className="btn btn-soft btn-sm" onClick={() => setSheet('compensar')}><ArrowLeftRight /> Usar saldo para la deuda</button>}
          {data.credito > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setSheet('devolver')}><Undo2 /> Devolver saldo</button>}
        </div>

        <section className="panel panel-pad stack" style={{ gap: 10 }}>
          <div className="row-between"><span className="muted">Talle habitual</span><b>{data.talle || '—'}{!c.talle && data.talleCompras ? <span className="subtle"> (por sus compras)</span> : ''}</b></div>
          <div className="row-between"><span className="muted">Cumpleaños</span><b>{c.cumple ? `${textoCumpleCorto(c.cumple)}${faltaCumple === 0 ? ' · ¡hoy! 🎂' : faltaCumple <= 7 ? ` · en ${faltaCumple} días` : ''}` : '—'}</b></div>
          <div className="row-between"><span className="muted">Última compra</span><b>{data.ultima ? (diasSinComprar === 0 ? 'hoy' : `hace ${diasSinComprar} ${diasSinComprar === 1 ? 'día' : 'días'}`) : '—'}</b></div>
          {c.telefono && (
            <div className="row wrap" style={{ marginTop: 4 }}>
              {faltaCumple !== null && faltaCumple <= 7 && (
                <a className="btn btn-soft btn-sm" href={waLink(c.telefono, textoCumple(c, cfg))} target="_blank" rel="noreferrer"><Cake /> Saludar</a>
              )}
              <a className="btn btn-soft btn-sm" href={waLink(c.telefono, textoNovedades(c, data.novedades, data.talle, cfg))} target="_blank" rel="noreferrer">
                <Sparkles /> Mandarle novedades{data.talle ? ` en ${data.talle}` : ''}
              </a>
            </div>
          )}
          {(!c.talle || !c.cumple) && <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setSheet('editar')}>Completar talle y cumpleaños</button>}
        </section>

        {c.notas && <div className="panel panel-pad"><span className="label">Notas</span><p style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{c.notas}</p></div>}

        <section className="stack">
          <h2 className="section-title">Movimientos</h2>
          {data.mov.length ? (
            <div className="list">
              {data.mov.map((m) => {
                if (m.tipo === 'venta') return (
                  <Link key={'v' + m.v.id} to={`/ventas/${m.v.id}`} className="list-item">
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="title ellipsis" style={{ display: 'block' }}>{m.v.items.map((i) => `${i.nombre} (${i.talle})`).join(', ')}</span>
                      <span className="subtle">{fechaRelativa(m.v.fecha)} · {m.v.cambioDe ? 'Cambio' : 'Compra'} #{m.v.id}</span>
                    </span>
                    <span style={{ textAlign: 'right' }}><b className="money">{money(m.v.total)}</b>{m.v.saldo > 0 && <><br /><span className="badge badge-bad">debe {money(m.v.saldo)}</span></>}</span>
                  </Link>
                )
                if (m.tipo === 'devolucion') return (
                  <Link key={'d' + m.d.id} to={`/ventas/${m.d.ventaId}`} className="list-item">
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="title ellipsis" style={{ display: 'block' }}>{m.d.tipo === 'cambio' ? 'Cambió' : 'Devolvió'} {m.d.items.map((i) => `${i.nombre} (${i.talle})`).join(', ')}</span>
                      <span className="subtle">{fechaRelativa(m.d.fecha)} · de la compra #{m.d.ventaId}</span>
                    </span>
                    <b className="money">−{money(m.d.valor)}</b>
                  </Link>
                )
                const etiqueta = { pago: 'Pago a cuenta', senia: 'Seña / adelanto', reintegro: 'Le devolviste saldo', compensa: 'Saldo usado para la deuda' }[m.tipo]
                const x = m.p || m.x
                return (
                  <div key={m.tipo + x.id} className="list-item">
                    <span className="grow"><span className="title">{etiqueta}</span><br /><span className="subtle">{fechaRelativa(x.fecha)}{m.p ? ` · ${METODO_LABEL[m.p.metodo]}` : ''}</span></span>
                    <b className="money" style={{ color: m.tipo === 'reintegro' ? undefined : 'var(--ok)' }}>{money(Math.abs(x.monto))}</b>
                  </div>
                )
              })}
            </div>
          ) : <div className="panel panel-pad muted">Todavía no compró nada.</div>}
        </section>

        <button className="btn btn-ghost" onClick={() => setSheet('borrar')}><Trash2 /> Eliminar clienta</button>
      </div>

      {sheet === 'cobrar' && (
        <MontoSheet titulo={`Cobrar a ${nombre}`} ayuda={`Debe ${money(data.deuda)}. Si paga una parte, el resto queda pendiente.`} inicial={data.deuda} boton="Registrar pago"
          onClose={cerrar}
          extra={(m) => m > data.deuda && <p className="alert alert-rose">Paga {money(m - data.deuda)} de más: quedan como saldo a favor.</p>}
          onConfirm={async (m, metodo) => { const r = await cobrarDeuda(cid, m, metodo); toast(r.aFavor > 0 ? `Cobraste ${money(m)} · ${money(r.aFavor)} quedan a favor` : `Cobraste ${money(m)}`) }} />
      )}
      {sheet === 'senia' && (
        <MontoSheet titulo={`Seña de ${nombre}`} ayuda="Entra a la caja hoy y queda como saldo a favor para su próxima compra." boton="Cargar seña"
          onClose={cerrar} onConfirm={async (m, metodo) => { await cargarSaldoAFavor(cid, m, metodo); toast('Seña cargada') }} />
      )}
      {sheet === 'devolver' && (
        <MontoSheet titulo={`Devolver saldo a ${nombre}`} ayuda={`Tiene ${money(data.credito)} a favor. Se anota hoy como salida de caja.`} inicial={data.credito} boton="Devolver"
          onClose={cerrar} onConfirm={async (m, metodo) => { await devolverSaldoAFavor(cid, m, metodo); toast('Saldo devuelto') }} />
      )}
      <Confirm open={sheet === 'compensar'} onClose={cerrar} title="¿Usar su saldo a favor para la deuda?" confirmLabel="Usar saldo"
        text={`Tiene ${money(data.credito)} a favor y debe ${money(data.deuda)}. Se cancela ${money(Math.min(data.credito, data.deuda))} de deuda; no entra plata a la caja.`}
        onConfirm={async () => { const u = await compensarDeudaConSaldo(cid); toast(`Se usaron ${money(u)} del saldo`) }} />
      {sheet === 'editar' && <ClientaForm open inicial={c} onClose={cerrar} />}
      <Confirm open={sheet === 'borrar'} onClose={cerrar} danger title="¿Eliminar clienta?" confirmLabel="Eliminar" disabled={data.deuda > 0}
        text={data.deuda > 0 ? `Todavía debe ${money(data.deuda)}. Primero cobrá o anulá esas ventas: si no, la deuda quedaría sin nombre y no la verías más.` : data.credito > 0 ? `Ojo: tiene ${money(data.credito)} a favor que se pierden. Sus ventas quedan registradas sin nombre.` : 'Sus ventas quedan registradas sin nombre.'}
        onConfirm={async () => {
          if (data.deuda > 0) throw new Error('Primero cobrá o anulá lo que debe: si no, la deuda queda sin nombre.')
          await db.transaction('rw', db.clientas, db.ventas, db.cobros, db.creditos, async () => {
            await db.ventas.where('clientaId').equals(cid).modify({ clientaId: null })
            await db.cobros.where('clientaId').equals(cid).modify({ clientaId: null })
            await db.creditos.where('clientaId').equals(cid).delete()
            await db.clientas.delete(cid)
          })
          toast('Clienta eliminada'); nav('/clientas', { replace: true })
        }} />
    </Page>
  )
}
