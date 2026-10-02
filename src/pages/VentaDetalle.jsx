import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, MessageCircle, ShoppingBag, Ban, PackageCheck, Undo2, Repeat, Pencil, Minus, Plus, X, UserPlus } from 'lucide-react'
import { db, anularVenta, devolverItems, editarVenta, calcDevolucion, METODOS, METODO_LABEL, METODOS_SIN_CAJA, CANALES, MOTIVOS_DEVOLUCION, MOTIVO_DEV_LABEL } from '../db'
import { useCart, useConfig } from '../store'
import { Page } from '../layout'
import { Tag, Sheet, Confirm, useToast } from '../ui'
import { money, fecha, hora, fechaRelativa, waLink, initials } from '../utils'
import { textoTicket } from '../textos'
import { ClientaPicker } from './Cobrar'

const restantes = (v) => v.items.map((it, idx) => ({ idx, cantidad: it.cantidad - (it.devuelto || 0) })).filter((l) => l.cantidad > 0)

/** Medio por defecto para devolver plata: el primero con que pagó (si fue plata). */
const medioOriginal = (v) => v.pagos.find((p) => !METODOS_SIN_CAJA.includes(p.metodo))?.metodo || 'efectivo'

/** Elegir a dónde va la plata que ya había pagado: saldo a favor o reintegro por un medio. */
function DestinoPicker({ value, onChange, clienta, monto }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="label">Ya había pagado {money(monto)}: ¿qué hacés con eso?</span>
      <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }} role="group" aria-label="Qué hacer con lo pagado">
        <button className="chip" aria-pressed={value === 'afavor'} disabled={!clienta} onClick={() => onChange('afavor')}>
          Saldo a favor{clienta ? ` de ${clienta.nombre.split(' ')[0]}` : ' (sin clienta)'}
        </button>
        {METODOS.map((m) => <button key={m.id} className="chip" aria-pressed={value === m.id} onClick={() => onChange(m.id)}>Devolver en {m.label.replace(' / MP', '').toLowerCase()}</button>)}
      </div>
      {value !== 'afavor' && <p className="subtle">Se anota hoy como salida de caja. Los días anteriores y sus cierres no cambian.</p>}
    </div>
  )
}

/** Por qué vuelve: sirve para ver en Devoluciones qué falla más (talles, calidad…). */
function MotivoPicker({ value, onChange, titulo = '¿Por qué?' }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="label">{titulo} <span className="subtle">(opcional)</span></span>
      <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }} role="group" aria-label="Motivo">
        {MOTIVOS_DEVOLUCION.map((m) => <button key={m.id} className="chip" aria-pressed={value === m.id} onClick={() => onChange(value === m.id ? null : m.id)}>{m.label}</button>)}
      </div>
    </div>
  )
}

const aDestino = (d) => (d === 'afavor' ? { tipo: 'afavor' } : { tipo: 'reintegro', metodo: d })

/** Elegir prendas que vuelven (para devolver o para cambiar). */
function DevolucionSheet({ v, clienta, modo, onClose }) {
  const toast = useToast()
  const cart = useCart()
  const nav = useNavigate()
  const [cant, setCant] = useState(() => Object.fromEntries(restantes(v).map((l) => [l.idx, v.items.length === 1 ? l.cantidad : 0])))
  const [destino, setDestino] = useState(() => (clienta && modo === 'devolver' ? 'afavor' : medioOriginal(v)))
  const [busy, setBusy] = useState(false)
  const [motivo, setMotivo] = useState(null)
  const lineas = Object.entries(cant).map(([idx, cantidad]) => ({ idx: Number(idx), cantidad })).filter((l) => l.cantidad > 0)
  const dev = calcDevolucion(v, lineas)

  const confirmar = async () => {
    if (modo === 'cambiar') {
      cart.setCambio({ ventaId: v.id, lineas, items: dev.items, resto: dev.resto, clientaId: v.clientaId || null, motivo })
      toast('Elegí las prendas que se lleva')
      nav('/vender')
      return
    }
    setBusy(true)
    try {
      await devolverItems(v.id, lineas, aDestino(destino), motivo)
      toast('Devolución registrada')
      onClose()
    } catch (e) { toast(e.message, 'error'); setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title={modo === 'cambiar' ? '¿Qué prendas cambia?' : '¿Qué prendas devuelve?'}>
      <div className="stack">
        <div className="list">
          {restantes(v).map(({ idx, cantidad: max }) => {
            const it = v.items[idx]
            const n = cant[idx] || 0
            return (
              <div key={idx} className="list-item">
                <span className="grow"><span className="title">{it.nombre}</span><br /><span className="subtle">Talle {it.talle}{it.color ? ` · ${it.color}` : ''} · {money(it.precio)}</span></span>
                <div className="qty" aria-label={`Cantidad de ${it.nombre} que vuelve`}>
                  <button onClick={() => setCant({ ...cant, [idx]: Math.max(0, n - 1) })} disabled={n === 0} aria-label="Una menos"><Minus /></button>
                  <span>{n}</span>
                  <button onClick={() => setCant({ ...cant, [idx]: Math.min(max, n + 1) })} disabled={n >= max} aria-label="Una más"><Plus /></button>
                </div>
              </div>
            )
          })}
        </div>
        {dev.items.length > 0 && (
          <div className="totals">
            <div className="row-between"><span className="muted">Valor de lo que vuelve{v.descuento || v.recargo ? ' (con descuento/recargo prorrateado)' : ''}</span><b>{money(dev.valor)}</b></div>
            {dev.aSaldo > 0 && <div className="row-between"><span className="muted">Baja de lo que debía</span><b>−{money(dev.aSaldo)}</b></div>}
            <div className="row-between grand"><span>{modo === 'cambiar' ? 'Crédito para el cambio' : 'A devolver'}</span><b>{money(dev.resto)}</b></div>
          </div>
        )}
        {dev.items.length > 0 && <MotivoPicker value={motivo} onChange={setMotivo} titulo={modo === 'cambiar' ? '¿Por qué la cambia?' : '¿Por qué la devuelve?'} />}
        {modo === 'devolver' && dev.resto > 0 && <DestinoPicker value={destino} onChange={setDestino} clienta={clienta} monto={dev.resto} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!dev.items.length || busy || (destino === 'afavor' && !clienta && dev.resto > 0)} onClick={confirmar}>
          {modo === 'cambiar' ? <><Repeat /> Elegir lo que se lleva</> : <><Undo2 /> Registrar devolución</>}
        </button>
        <p className="subtle">Las prendas vuelven al stock{modo === 'cambiar' ? ' cuando confirmes la venta nueva' : ''}.</p>
      </div>
    </Sheet>
  )
}

function EditarSheet({ v, clienta, onClose }) {
  const toast = useToast()
  const [c, setC] = useState(clienta)
  const [pick, setPick] = useState(false)
  const [canal, setCanal] = useState(v.canal || 'local')
  const [nota, setNota] = useState(v.nota || '')
  const [entregada, setEntregada] = useState(v.entregada !== false)
  const [metodos, setMetodos] = useState({})

  const guardar = async () => {
    try {
      await editarVenta(v.id, { clientaId: c?.id || null, canal, nota: nota.trim(), entregada, metodos })
      toast('Venta corregida')
      onClose()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <Sheet open={!pick} onClose={onClose} title={`Corregir venta #${v.id}`}>
        <div className="stack">
          <div className="stack" style={{ gap: 6 }}>
            <span className="label">Clienta</span>
            {c ? (
              <div className="panel panel-pad row">
                <span className="avatar">{initials(c.nombre)}</span><b className="grow">{c.nombre}</b>
                <button className="icon-btn" onClick={() => setC(null)} aria-label="Quitar clienta"><X /></button>
              </div>
            ) : <button className="btn btn-ghost" onClick={() => setPick(true)}><UserPlus /> Asignar clienta</button>}
          </div>
          {v.pagos.some((p) => !METODOS_SIN_CAJA.includes(p.metodo)) && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="label">Medio de pago</span>
              {v.pagos.map((p, i) => METODOS_SIN_CAJA.includes(p.metodo) ? null : (
                <div key={i} className="row">
                  <select className="select grow" value={metodos[i] || p.metodo} onChange={(e) => setMetodos({ ...metodos, [i]: e.target.value })} aria-label={`Medio del pago de ${money(p.monto)}`}>
                    {METODOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <b className="money">{money(p.monto)}</b>
                </div>
              ))}
            </div>
          )}
          <div className="seg" role="group" aria-label="Canal de venta">
            {CANALES.map((x) => <button key={x.id} aria-pressed={canal === x.id} onClick={() => setCanal(x.id)}>{x.label}</button>)}
          </div>
          <label className="row"><input type="checkbox" checked={!entregada} onChange={(e) => setEntregada(!e.target.checked)} /> Apartada (todavía no se entregó)</label>
          <label className="field"><span>Nota</span><input className="input" value={nota} onChange={(e) => setNota(e.target.value)} /></label>
          <button className="btn btn-primary btn-block" onClick={guardar}>Guardar</button>
          <p className="subtle">Para cambiar prendas o montos usá Devolver o Cambiar.</p>
        </div>
      </Sheet>
      <ClientaPicker open={pick} onClose={() => setPick(false)} onPick={(x) => { setC(x); setPick(false) }} />
    </>
  )
}

export default function VentaDetalle() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nueva = sp.get('nueva') === '1'
  const cfg = useConfig()
  const toast = useToast()
  const [sheet, setSheet] = useState(null) // 'devolver' | 'cambiar' | 'editar' | 'anular'
  const [destinoAnular, setDestinoAnular] = useState(null)
  const [motivoAnular, setMotivoAnular] = useState(null)
  const data = useLiveQuery(async () => {
    const v = await db.ventas.get(Number(id))
    if (!v) return { v: null }
    const [clienta, devoluciones, reintegros] = await Promise.all([
      v.clientaId ? db.clientas.get(v.clientaId) : null,
      db.devoluciones.where('ventaId').equals(v.id).toArray(),
      db.cobros.where('ventaId').equals(v.id).filter((c) => c.tipo === 'reintegro').toArray(),
    ])
    return { v, clienta, devoluciones, reintegros }
  }, [id])

  if (!data || !cfg) return <Page title="Venta" back="/ventas" />
  const { v, clienta, devoluciones } = data
  if (!v) return <Page title="Venta" back="/ventas"><p className="muted">No encontramos esta venta.</p></Page>

  const quedan = restantes(v)
  const devAnular = quedan.length ? calcDevolucion(v, quedan) : { resto: 0 }
  const destinoA = destinoAnular ?? (clienta ? 'afavor' : medioOriginal(v))

  return (
    <Page title={`Venta #${v.id}`} back="/ventas" actions={!v.anulada && <button className="icon-btn" onClick={() => setSheet('editar')} aria-label="Corregir venta"><Pencil /></button>}>
      <div className="stack-lg" style={{ maxWidth: 520, margin: '0 auto' }}>
        {nueva && (
          <div className="ticket-done">
            <span className="ok-disc"><Check size={28} /></span>
            <h2 style={{ fontSize: 'var(--fs-lg)' }}>{v.cambioDe ? '¡Cambio registrado!' : '¡Venta registrada!'}</h2>
            <p className="muted">El stock ya se actualizó{v.saldo > 0 ? ' y el saldo quedó en la cuenta de la clienta' : ''}.</p>
          </div>
        )}

        <Tag string className="ticket">
          <p className="ticket-brand">{cfg.tienda}</p>
          <p className="ticket-sub">Comprobante #{v.id} · {fecha(v.fecha)} {hora(v.fecha)}</p>
          <div className="perf" aria-hidden="true" />
          <div className="stack" style={{ gap: 8 }}>
            {v.items.map((i, k) => (
              <div key={k} className="row-between" style={{ alignItems: 'flex-start' }}>
                <span className="grow">
                  <b style={{ fontWeight: 600, textDecoration: i.devuelto >= i.cantidad ? 'line-through' : undefined }}>{i.nombre}</b><br />
                  <span className="subtle">{i.libre ? 'Ítem libre' : `Talle ${i.talle}${i.color ? ` · ${i.color}` : ''}`} · ×{i.cantidad}{i.precioLista ? <> · <s>{money(i.precioLista)}</s> {money(i.precio)} c/u</> : ''}</span>
                  {i.devuelto > 0 && <> <span className="badge badge-muted">devuelta{i.devuelto < i.cantidad ? ` ×${i.devuelto}` : ''}</span></>}
                </span>
                <b className="money">{money(i.precio * i.cantidad)}</b>
              </div>
            ))}
          </div>
          <div className="perf" aria-hidden="true" />
          <div className="totals">
            {(v.descuento > 0 || v.recargo > 0) && <div className="row-between"><span className="muted">Subtotal</span><b>{money(v.subtotal)}</b></div>}
            {v.descuento > 0 && <div className="row-between"><span className="muted">Descuento</span><b>−{money(v.descuento)}</b></div>}
            {v.recargo > 0 && <div className="row-between"><span className="muted">Recargo</span><b>+{money(v.recargo)}</b></div>}
            <div className="row-between grand"><span>Total</span><b>{money(v.total)}</b></div>
            {v.pagos.map((p, k) => <div key={k} className="row-between"><span className="muted">{METODO_LABEL[p.metodo]}</span><b>{money(p.monto)}</b></div>)}
            {v.cuenta > 0 && <div className="row-between"><span className="muted">Pagos a cuenta después</span><b>{money(v.cuenta)}</b></div>}
            {v.devuelto > 0 && <div className="row-between"><span className="muted">Devuelto</span><b>−{money(v.devuelto)}</b></div>}
            {v.saldo > 0 && <div className="row-between" style={{ color: 'var(--bad)' }}><span>Saldo pendiente</span><b>{money(v.saldo)}</b></div>}
          </div>
          <div className="perf" aria-hidden="true" />
          <div className="row wrap" style={{ gap: 6 }}>
            {v.anulada ? <span className="badge badge-bad">Anulada</span> : v.estado === 'devuelta' ? <span className="badge badge-muted">Devuelta</span> : v.saldo > 0 ? <span className="badge badge-bad">Debe</span> : <span className="badge badge-ok">Pagada</span>}
            <span className="badge badge-rose">{CANALES.find((c) => c.id === v.canal)?.label || 'Local'}</span>
            {!v.entregada && !v.anulada && <span className="badge badge-warn">Apartada</span>}
            {clienta && <Link to={`/clientas/${clienta.id}`} className="badge badge-muted" style={{ textDecoration: 'none' }}>{clienta.nombre}</Link>}
            {v.cambioDe && <Link to={`/ventas/${v.cambioDe}`} className="badge badge-muted" style={{ textDecoration: 'none' }}>Cambio de #{v.cambioDe}</Link>}
          </div>
          {v.nota && <p className="subtle" style={{ marginTop: 10 }}>{v.nota}</p>}
        </Tag>

        {devoluciones.length > 0 && (
          <section className="stack">
            <h2 className="section-title">Devoluciones y cambios</h2>
            <div className="list">
              {devoluciones.map((d) => (
                <div key={d.id} className="list-item">
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="title">{d.tipo === 'cambio' ? 'Cambio' : d.tipo === 'anulacion' ? 'Anulación' : 'Devolución'} · {fechaRelativa(d.fecha)}</span><br />
                    {d.motivo && <><span className="subtle">Motivo: {MOTIVO_DEV_LABEL[d.motivo] || d.motivo}</span><br /></>}
                    <span className="subtle">{d.items.map((i) => `${i.nombre} (${i.talle}) ×${i.cantidad}`).join(', ')}</span><br />
                    <span className="subtle">
                      {d.aSaldo > 0 && `Bajó ${money(d.aSaldo)} de deuda. `}
                      {d.tipo === 'cambio' && d.resto - (d.destinoMonto || 0) > 0 && `${money(d.resto - (d.destinoMonto || 0))} usados en el cambio. `}
                      {d.destinoMonto > 0 && (d.destino === 'afavor' ? `${money(d.destinoMonto)} a favor.` : `Se devolvieron ${money(d.destinoMonto)} en ${(METODO_LABEL[d.destino] || d.destino).toLowerCase()}.`)}
                    </span>
                  </span>
                  {d.cambioVentaId && <Link to={`/ventas/${d.cambioVentaId}`} className="badge badge-rose" style={{ textDecoration: 'none' }}>#{d.cambioVentaId}</Link>}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="stack">
          {!v.anulada && (
            <a className="btn btn-wa btn-block" href={waLink(clienta?.telefono, textoTicket(v, clienta, cfg))} target="_blank" rel="noreferrer">
              <MessageCircle /> Enviar comprobante por WhatsApp
            </a>
          )}
          {!v.entregada && !v.anulada && (
            <button className="btn btn-soft btn-block" onClick={async () => { await db.ventas.update(v.id, { entregada: true }); toast('Marcada como entregada') }}>
              <PackageCheck /> Marcar como entregada
            </button>
          )}
          {nueva && <Link className="btn btn-primary btn-block btn-lg" to="/vender"><ShoppingBag /> Nueva venta</Link>}
          {!v.anulada && quedan.length > 0 && (
            <div className="grid-2">
              <button className="btn btn-soft" onClick={() => setSheet('cambiar')}><Repeat /> Cambiar</button>
              <button className="btn btn-soft" onClick={() => setSheet('devolver')}><Undo2 /> Devolver</button>
            </div>
          )}
          {!v.anulada && (
            <button className="btn btn-ghost btn-block" onClick={() => setSheet('anular')}><Ban /> Anular venta</button>
          )}
        </div>
      </div>

      {(sheet === 'devolver' || sheet === 'cambiar') && <DevolucionSheet v={v} clienta={clienta} modo={sheet} onClose={() => setSheet(null)} />}
      {sheet === 'editar' && <EditarSheet v={v} clienta={clienta} onClose={() => setSheet(null)} />}
      <Confirm
        open={sheet === 'anular'} onClose={() => setSheet(null)} danger confirmLabel="Anular venta" title="¿Anular esta venta?"
        text={`Las prendas vuelven al stock${v.saldo > 0 ? ' y se cancela lo que debía' : ''}. Lo cobrado en su día queda registrado ese día.`}
        disabled={devAnular.resto > 0 && destinoA === 'afavor' && !clienta}
        onConfirm={async () => { await anularVenta(v.id, aDestino(destinoA), motivoAnular); toast('Venta anulada') }}
      >
        <MotivoPicker value={motivoAnular} onChange={setMotivoAnular} titulo="¿Por qué se anula?" />
        {devAnular.resto > 0 && <DestinoPicker value={destinoA} onChange={setDestinoAnular} clienta={clienta} monto={devAnular.resto} />}
      </Confirm>
    </Page>
  )
}
