import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Banknote, Landmark, CreditCard, WalletCards, NotebookPen, UserPlus, X, Plus, Search } from 'lucide-react'
import { db, CANALES, METODOS, METODO_LABEL, registrarVenta, saldoAFavor } from '../db'
import { useCart, useConfig } from '../store'
import { Page } from '../layout'
import { Tag, Sheet, MoneyInput, useToast } from '../ui'
import { money, initials } from '../utils'
import { CartLines, CambioBanner, CartTools } from './Vender'

const PAY = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'transferencia', label: 'Transferencia / MP', icon: Landmark },
  { id: 'debito', label: 'Débito', icon: WalletCards },
  { id: 'credito', label: 'Crédito', icon: CreditCard },
]

export function ClientaPicker({ open, onClose, onPick }) {
  const [q, setQ] = useState('')
  const [nueva, setNueva] = useState(null)
  const clientas = useLiveQuery(() => db.clientas.orderBy('nombre').toArray(), [])
  const t = q.trim().toLowerCase()
  const lista = (clientas || []).filter((c) => !t || c.nombre.toLowerCase().includes(t) || (c.telefono || '').includes(t))

  const guardar = async () => {
    if (!nueva.nombre.trim()) return
    const id = await db.clientas.add({ nombre: nueva.nombre.trim(), telefono: nueva.telefono.trim(), instagram: '', notas: '', creado: Date.now() })
    onPick(await db.clientas.get(id))
    setNueva(null); setQ('')
  }

  return (
    <Sheet open={open} onClose={() => { setNueva(null); onClose() }} title={nueva ? 'Nueva clienta' : 'Elegí la clienta'}>
      {nueva ? (
        <div className="stack">
          <label className="field"><span>Nombre</span><input className="input" autoFocus value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} /></label>
          <label className="field"><span>WhatsApp</span><input className="input" inputMode="tel" placeholder="381 555 0000" value={nueva.telefono} onChange={(e) => setNueva({ ...nueva, telefono: e.target.value })} /></label>
          <button className="btn btn-primary btn-block" disabled={!nueva.nombre.trim()} onClick={guardar}>Guardar y elegir</button>
        </div>
      ) : (
        <div className="stack">
          <label className="search"><Search /><span className="sr-only">Buscar clienta</span><input className="input" placeholder="Nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <button className="btn btn-soft" onClick={() => setNueva({ nombre: q, telefono: '' })}><UserPlus /> Nueva clienta{q ? `: ${q}` : ''}</button>
          {lista.length > 0 && (
            <div className="list" style={{ maxHeight: '46dvh', overflowY: 'auto' }}>
              {lista.map((c) => (
                <button key={c.id} className="list-item" onClick={() => { onPick(c); setQ('') }}>
                  <span className="avatar">{initials(c.nombre)}</span>
                  <span className="grow"><span className="title">{c.nombre}</span><br /><span className="subtle">{c.telefono || 'Sin teléfono'}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

export default function Cobrar() {
  const cart = useCart()
  const cfg = useConfig()
  const nav = useNavigate()
  const toast = useToast()
  const cambio = cart.cambio
  const [clientaSel, setClientaSel] = useState(undefined) // undefined = la de la venta original del cambio
  const [pickClienta, setPickClienta] = useState(false)
  const [canal, setCanal] = useState('local')
  const [descPct, setDescPct] = useState(0)
  const [descMonto, setDescMonto] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [dividir, setDividir] = useState(false)
  const [pagos, setPagos] = useState([])
  const [recargo, setRecargo] = useState(false)
  const [entregada, setEntregada] = useState(true)
  const [nota, setNota] = useState('')
  const [usarSaldo, setUsarSaldo] = useState(true)
  const [excedente, setExcedente] = useState('efectivo') // 'afavor' o un medio de pago para devolver
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!cart.items.length && !busy) nav('/vender', { replace: true }) }, [cart.items.length, busy, nav])

  const clientaCambio = useLiveQuery(async () => (cambio?.clientaId ? (await db.clientas.get(cambio.clientaId)) || null : null), [cambio?.clientaId])
  const clienta = clientaSel === undefined ? clientaCambio || null : clientaSel
  const credito = useLiveQuery(() => saldoAFavor(clienta?.id), [clienta?.id]) || 0

  const subtotal = cart.subtotal
  const descuento = descMonto !== '' ? Math.min(Number(descMonto) || 0, subtotal) : Math.round((subtotal * descPct) / 100)
  const recargoMonto = recargo && cfg?.recargoCredito ? Math.round(((subtotal - descuento) * cfg.recargoCredito) / 100) : 0
  const total = Math.max(0, subtotal - descuento + recargoMonto)

  // Primero se usa el crédito del cambio, después el saldo a favor; el resto se paga.
  const cambioUsado = cambio ? Math.min(cambio.resto, total) : 0
  const sobraCambio = cambio ? cambio.resto - cambioUsado : 0
  const creditoUsado = usarSaldo ? Math.min(credito, total - cambioUsado) : 0
  const aPagar = total - cambioUsado - creditoUsado

  const pagosFinal = useMemo(() => {
    const base = []
    if (cambioUsado > 0) base.push({ metodo: 'cambio', monto: cambioUsado })
    if (creditoUsado > 0) base.push({ metodo: 'afavor', monto: creditoUsado })
    if (aPagar <= 0) return base
    if (dividir) return [...base, ...pagos.filter((p) => p.monto > 0)]
    if (metodo === 'fiado') return base
    return [...base, { metodo, monto: aPagar }]
  }, [cambioUsado, creditoUsado, aPagar, metodo, dividir, pagos])
  const pagado = pagosFinal.reduce((s, p) => s + p.monto, 0)
  const saldo = total - pagado
  const destinoExcedente = excedente === 'afavor' ? { tipo: 'afavor' } : { tipo: 'reintegro', metodo: excedente }
  const error =
    pagado > total ? 'Los pagos superan el total de la venta.'
      : saldo > 0 && !clienta ? 'Para dejar saldo a cuenta, elegí la clienta.'
        : sobraCambio > 0 && excedente === 'afavor' && !clienta ? 'Para dejar la diferencia a favor, elegí la clienta.'
          : null

  const abrirDividir = () => {
    setDividir(true)
    setPagos([{ metodo: metodo === 'fiado' ? 'efectivo' : metodo, monto: '' }])
  }

  const confirmar = async () => {
    if (error) return
    setBusy(true)
    try {
      const id = await registrarVenta({
        items: cart.items.map((i) => ({
          productoId: i.productoId, varianteId: i.varianteId, nombre: i.nombre, talle: i.talle, color: i.color, precio: i.precio, costo: i.costo, categoria: i.categoria, cantidad: i.cantidad,
          ...(i.precioLista !== undefined && i.precioLista !== i.precio ? { precioLista: i.precioLista } : {}), ...(i.libre ? { libre: true } : {}),
        })),
        subtotal, descuento, recargo: recargoMonto, total,
        pagos: pagosFinal, clientaId: clienta?.id || null, canal, nota: nota.trim(), entregada,
      }, cambio ? { cambio: { ventaId: cambio.ventaId, lineas: cambio.lineas, excedente: destinoExcedente, motivo: cambio.motivo || null } } : {})
      cart.clear()
      toast(cambio ? 'Cambio registrado' : 'Venta registrada')
      nav(`/ventas/${id}?nueva=1`, { replace: true })
    } catch (e) {
      setBusy(false)
      toast(e.message || 'No se pudo registrar la venta.', 'error')
    }
  }

  if (!cfg) return null
  const pctOpts = [...new Set([0, cfg.descuentoEfectivo || 10, 15, 20])]

  return (
    <Page title={cambio ? 'Cobrar cambio' : 'Cobrar'} back="/vender">
      <div className="stack-lg" style={{ maxWidth: 620, margin: '0 auto' }}>
        <CambioBanner />
        <Tag string>
          <div className="stack">
            <div className="row-between"><h2 className="section-title">Prendas</h2><Link to="/vender" className="link-btn">+ Agregar más</Link></div>
            <CartLines />
            <CartTools despues={() => nav('/vender', { replace: true })} />
          </div>
        </Tag>

        <section className="stack">
          <h2 className="section-title">Clienta</h2>
          {clienta ? (
            <div className="panel panel-pad row">
              <span className="avatar">{initials(clienta.nombre)}</span>
              <span className="grow"><b>{clienta.nombre}</b><br /><span className="subtle">{credito > 0 ? `Tiene ${money(credito)} a favor` : clienta.telefono || 'Sin teléfono'}</span></span>
              <button className="icon-btn" onClick={() => setClientaSel(null)} aria-label="Quitar clienta"><X /></button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-block" onClick={() => setPickClienta(true)}><UserPlus /> Asignar clienta (opcional)</button>
          )}
          {credito > 0 && (
            <label className="row"><input type="checkbox" checked={usarSaldo} onChange={(e) => setUsarSaldo(e.target.checked)} /> Usar su saldo a favor ({money(credito)})</label>
          )}
          <div className="seg" role="group" aria-label="Canal de venta">
            {CANALES.map((c) => <button key={c.id} aria-pressed={canal === c.id} onClick={() => setCanal(c.id)}>{c.label}</button>)}
          </div>
        </section>

        <section className="stack">
          <h2 className="section-title">Descuento</h2>
          <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }} role="group" aria-label="Descuento">
            {pctOpts.map((p) => (
              <button key={p} className="chip" aria-pressed={descMonto === '' && descPct === p} onClick={() => { setDescPct(p); setDescMonto('') }}>
                {p === 0 ? 'Sin descuento' : `${p}%`}
              </button>
            ))}
          </div>
          <label className="field">
            <span>O un monto fijo</span>
            <MoneyInput value={descMonto} onChange={setDescMonto} placeholder="0" />
          </label>
        </section>

        {aPagar > 0 ? (
          <section className="stack">
            <h2 className="section-title">¿Cómo paga{cambioUsado + creditoUsado > 0 ? ` los ${money(aPagar)} que faltan` : ''}?</h2>
            {!dividir ? (
              <>
                <div className="pay-grid" role="group" aria-label="Medio de pago">
                  {PAY.map(({ id, label, icon: Icon }) => (
                    <button key={id} className="pay-opt" aria-pressed={metodo === id} onClick={() => { setMetodo(id); setRecargo(id === 'credito' && (cfg.recargoCredito || 0) > 0) }}><Icon />{label}</button>
                  ))}
                  <button className="pay-opt" style={{ gridColumn: '1 / -1' }} aria-pressed={metodo === 'fiado'} onClick={() => { setMetodo('fiado'); setRecargo(false) }}>
                    <NotebookPen />Todo a cuenta (fiado)
                  </button>
                </div>
                <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={abrirDividir}>Paga con dos medios o deja una seña</button>
              </>
            ) : (
              <div className="stack">
                {pagos.map((p, i) => (
                  <div className="row" key={i}>
                    <select className="select" style={{ width: '48%' }} value={p.metodo} onChange={(e) => setPagos(pagos.map((x, j) => (j === i ? { ...x, metodo: e.target.value } : x)))} aria-label="Medio">
                      {PAY.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <div className="grow"><MoneyInput value={p.monto} onChange={(v) => setPagos(pagos.map((x, j) => (j === i ? { ...x, monto: v === '' ? '' : v } : x)))} aria-label="Monto" /></div>
                    <button className="icon-btn" aria-label="Quitar pago" onClick={() => setPagos(pagos.filter((_, j) => j !== i))}><X /></button>
                  </div>
                ))}
                <div className="row wrap">
                  <button className="btn btn-soft btn-sm" onClick={() => setPagos([...pagos, { metodo: 'transferencia', monto: Math.max(0, saldo) || '' }])}><Plus /> Otro medio</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setDividir(false); setPagos([]) }}>Pago simple</button>
                </div>
                <p className="subtle">Lo que no se pague ahora queda a cuenta de la clienta (seña o fiado).</p>
              </div>
            )}
            {(cfg.recargoCredito || 0) > 0 && (
              <label className="row"><input type="checkbox" checked={recargo} onChange={(e) => setRecargo(e.target.checked)} /> Recargo por cuotas ({cfg.recargoCredito}%)</label>
            )}
          </section>
        ) : (
          <p className="alert alert-rose">No tiene que pagar nada: {cambioUsado > 0 ? 'lo cubre el cambio' : 'lo cubre su saldo a favor'}.</p>
        )}

        {sobraCambio > 0 && (
          <section className="panel panel-pad stack">
            <h2 className="section-title">Sobran {money(sobraCambio)} del cambio</h2>
            <p className="subtle">La prenda nueva sale menos que la que devuelve. ¿Qué hacés con la diferencia?</p>
            <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }} role="group" aria-label="Diferencia del cambio">
              <button className="chip" aria-pressed={excedente === 'afavor'} onClick={() => setExcedente('afavor')} disabled={!clienta}>Queda a favor{clienta ? '' : ' (elegí clienta)'}</button>
              {METODOS.map((m) => <button key={m.id} className="chip" aria-pressed={excedente === m.id} onClick={() => setExcedente(m.id)}>Devolver en {m.label.replace(' / MP', '').toLowerCase()}</button>)}
            </div>
          </section>
        )}

        <section className="stack">
          <label className="row"><input type="checkbox" checked={!entregada} onChange={(e) => setEntregada(!e.target.checked)} /> La prenda queda apartada (se entrega después)</label>
          <label className="field"><span>Nota (opcional)</span><input className="input" placeholder="Ej: envío a Yerba Buena el jueves" value={nota} onChange={(e) => setNota(e.target.value)} /></label>
        </section>

        <Tag>
          <div className="totals">
            <div className="row-between"><span className="muted">Subtotal</span><b>{money(subtotal)}</b></div>
            {descuento > 0 && <div className="row-between"><span className="muted">Descuento</span><b>−{money(descuento)}</b></div>}
            {recargoMonto > 0 && <div className="row-between"><span className="muted">Recargo</span><b>+{money(recargoMonto)}</b></div>}
            <div className="row-between grand"><span>Total</span><b>{money(total)}</b></div>
            {pagosFinal.map((p, i) => <div key={i} className="row-between"><span className="muted">{METODO_LABEL[p.metodo]}</span><b>{money(p.monto)}</b></div>)}
            {saldo > 0 && <div className="row-between" style={{ color: 'var(--bad)' }}><span>Queda a cuenta</span><b>{money(saldo)}</b></div>}
            {sobraCambio > 0 && <div className="row-between" style={{ color: 'var(--ok)' }}><span>{excedente === 'afavor' ? 'Queda a favor' : 'Le devolvés'}</span><b>{money(sobraCambio)}</b></div>}
          </div>
        </Tag>

        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={!!error || busy || !cart.items.length} onClick={confirmar}>
          {cambio ? `Confirmar cambio · cobrás ${money(pagado - cambioUsado - creditoUsado)}` : `Confirmar venta · ${money(total)}`}
        </button>
      </div>

      <ClientaPicker open={pickClienta} onClose={() => setPickClienta(false)} onPick={(c) => { setClientaSel(c); setPickClienta(false) }} />
    </Page>
  )
}
