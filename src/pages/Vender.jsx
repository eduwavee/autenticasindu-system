import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, Minus, ShoppingBag, Check, Trash2, ScanLine, Repeat, X, PauseCircle, PlayCircle, PencilLine, Tag as TagIcon } from 'lucide-react'
import { db, CATEGORIAS } from '../db'
import { useCart, useConfig, claveLinea } from '../store'
import { useProductosConStock } from '../hooks'
import { Page } from '../layout'
import { Tag, Rack, Sheet, Confirm, MoneyInput, ProductImg, Empty, EmptyRackArt, useToast } from '../ui'
import { money, colorHex, leerCodigo, fechaRelativa } from '../utils'
import Escaner, { puedeEscanear } from './Escaner'

const lineaCarrito = (p, v) => ({ productoId: p.id, varianteId: v.id, nombre: p.nombre, talle: v.talle, color: v.color, precio: p.precio, costo: p.costo || 0, categoria: p.categoria, foto: p.foto, max: v.stock })

export function ProductTag({ p, onClick, selected, children }) {
  return (
    <button type="button" className={`ptag ${selected ? 'selected' : ''}`} onClick={onClick} disabled={!onClick}>
      <Tag>
        <div className="ptag-img"><ProductImg producto={p} /></div>
        <span className="ptag-name">{p.nombre}</span>
        <div className="ptag-foot">
          <span className="ptag-price">{money(p.precio)}</span>
          {children}
        </div>
      </Tag>
      {selected && <span className="check"><Check /></span>}
    </button>
  )
}

/** Fotos de las prendas del carrito (el carrito guardado no lleva la foto, se busca por producto). */
function useFotosCarrito(items) {
  const ids = [...new Set(items.map((i) => i.productoId).filter(Boolean))].join(',')
  return useLiveQuery(async () => {
    if (!ids) return {}
    const ps = await db.productos.bulkGet(ids.split(',').map(Number))
    return Object.fromEntries(ps.filter(Boolean).map((p) => [p.id, p.foto]))
  }, [ids]) || {}
}

function PrecioSheet({ linea, onClose }) {
  const cart = useCart()
  const [precio, setPrecio] = useState(linea.precio)
  const guardar = () => { cart.setPrecio(claveLinea(linea), precio); onClose() }
  return (
    <Sheet open onClose={onClose} title="Precio para esta venta">
      <div className="stack">
        <p className="muted">{linea.nombre}{linea.libre ? '' : ` · talle ${linea.talle}`}. {linea.precioLista !== undefined && !linea.libre ? `Precio de lista: ${money(linea.precioLista)}.` : ''}</p>
        <label className="field"><span>Precio por unidad</span><MoneyInput value={precio} onChange={setPrecio} autoFocus onKeyDown={(e) => e.key === 'Enter' && guardar()} /></label>
        <div className="grid-2">
          {!linea.libre && linea.precio !== linea.precioLista ? <button className="btn btn-ghost" onClick={() => { cart.setPrecio(claveLinea(linea), linea.precioLista); onClose() }}>Volver al de lista</button> : <span />}
          <button className="btn btn-primary" onClick={guardar}>Aplicar</button>
        </div>
        <p className="subtle">Cambia solo en esta venta; el precio de la prenda no se toca.</p>
      </div>
    </Sheet>
  )
}

export function CartLines({ editable = true }) {
  const cart = useCart()
  const fotos = useFotosCarrito(cart.items)
  const [editar, setEditar] = useState(null)
  return (
    <div>
      {cart.items.map((i) => {
        const k = claveLinea(i)
        const especial = i.precioLista !== undefined && i.precio !== i.precioLista
        return (
          <div className="line" key={k}>
            <div className="line-thumb">{i.libre ? <TagIcon style={{ color: 'var(--rose-300)', margin: 'auto' }} /> : <ProductImg producto={{ ...i, foto: fotos[i.productoId] }} />}</div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }} className="ellipsis">{i.nombre}</div>
              <div className="subtle">
                {i.libre ? 'Ítem libre' : `Talle ${i.talle}${i.color ? ` · ${i.color}` : ''}`} ·{' '}
                {editable ? (
                  <button className="link-btn" onClick={() => setEditar(i)} aria-label={`Cambiar precio de ${i.nombre}`}>
                    {especial && <s style={{ opacity: 0.6, marginRight: 4 }}>{money(i.precioLista)}</s>}{money(i.precio)} <PencilLine size={12} />
                  </button>
                ) : <>{especial && <s style={{ opacity: 0.6, marginRight: 4 }}>{money(i.precioLista)}</s>}{money(i.precio)}</>}
              </div>
            </div>
            {editable ? (
              <div className="qty" aria-label={`Cantidad de ${i.nombre}`}>
                <button onClick={() => cart.setQty(k, i.cantidad - 1)} aria-label="Quitar uno">{i.cantidad === 1 ? <Trash2 /> : <Minus />}</button>
                <span>{i.cantidad}</span>
                <button onClick={() => cart.setQty(k, i.cantidad + 1)} disabled={i.cantidad >= (i.max ?? 999)} aria-label="Agregar uno"><Plus /></button>
              </div>
            ) : <span className="num">×{i.cantidad}</span>}
          </div>
        )
      })}
      {editar && <PrecioSheet linea={editar} onClose={() => setEditar(null)} />}
    </div>
  )
}

/** Acciones del carrito: poner en espera, ítem libre y vaciar. */
export function CartTools({ despues }) {
  const cart = useCart()
  const toast = useToast()
  const [hoja, setHoja] = useState(null) // 'espera' | 'libre' | 'vaciar'
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const cerrar = () => { setHoja(null); setNombre(''); setPrecio('') }

  const enEspera = async () => {
    await cart.ponerEnEspera(nombre)
    toast('Venta en espera')
    cerrar()
    despues?.()
  }
  const libre = () => {
    if (!nombre.trim() || !(Number(precio) > 0)) return
    cart.addLibre(nombre.trim(), Number(precio))
    toast(`${nombre.trim()} al carrito`)
    cerrar()
  }

  return (
    <>
      <div className="row wrap" style={{ gap: 6 }}>
        <button className="btn btn-soft btn-sm" onClick={() => setHoja('libre')}><Plus /> Ítem libre</button>
        {cart.items.length > 0 && <button className="btn btn-soft btn-sm" onClick={() => setHoja('espera')}><PauseCircle /> En espera</button>}
        {cart.items.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setHoja('vaciar')}><Trash2 /> Vaciar</button>}
      </div>
      {hoja === 'espera' && (
        <Sheet open onClose={cerrar} title="Poner la venta en espera">
          <div className="stack">
            <p className="muted">Se guarda el carrito ({cart.count} {cart.count === 1 ? 'prenda' : 'prendas'}, {money(cart.subtotal)}) para seguir después y atender otra venta mientras tanto.</p>
            <label className="field"><span>¿De quién es? (opcional)</span><input className="input" autoFocus placeholder="Ej: chica del probador, Lucía" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enEspera()} /></label>
            <button className="btn btn-primary btn-block" onClick={enEspera}><PauseCircle /> Poner en espera</button>
            <p className="subtle">El stock no se reserva: al retomarla se controla de nuevo.</p>
          </div>
        </Sheet>
      )}
      {hoja === 'libre' && (
        <Sheet open onClose={cerrar} title="Agregar ítem libre">
          <div className="stack">
            <p className="muted">Para lo que no está en el stock: un arreglo, una bolsa de regalo, una prenda que todavía no cargaste.</p>
            <label className="field"><span>Qué es</span><input className="input" autoFocus placeholder="Ej: Arreglo de ruedo" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
            <label className="field"><span>Precio</span><MoneyInput value={precio} onChange={setPrecio} onKeyDown={(e) => e.key === 'Enter' && libre()} /></label>
            <button className="btn btn-primary btn-block" disabled={!nombre.trim() || !(Number(precio) > 0)} onClick={libre}><Plus /> Agregar</button>
          </div>
        </Sheet>
      )}
      <Confirm open={hoja === 'vaciar'} onClose={cerrar} danger title="¿Vaciar el carrito?" confirmLabel="Vaciar"
        text="Se sacan todas las prendas de la venta actual. El stock no se tocó todavía." onConfirm={() => { cart.clear(); toast('Carrito vacío') }} />
    </>
  )
}

/** Ventas en espera: retomar o descartar. */
export function EsperasBar() {
  const cart = useCart()
  const toast = useToast()
  const esperas = useLiveQuery(() => db.esperas.orderBy('creado').toArray(), [])
  const [abierta, setAbierta] = useState(false)
  if (!esperas?.length) return null
  const total = (e) => e.items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  return (
    <>
      <button className="alert alert-warn espera-bar" onClick={() => setAbierta(true)}>
        <PauseCircle />
        <span className="grow" style={{ textAlign: 'left' }}><b>{esperas.length} {esperas.length === 1 ? 'venta en espera' : 'ventas en espera'}</b> · {esperas.map((e) => e.nombre || 'sin nombre').join(', ')}</span>
        <span className="link-btn">Ver</span>
      </button>
      {abierta && (
        <Sheet open onClose={() => setAbierta(false)} title="Ventas en espera">
          <div className="stack">
            {cart.items.length > 0 && <p className="subtle">Al retomar una, la venta que tenés ahora queda en espera.</p>}
            <div className="list">
              {esperas.map((e) => (
                <div key={e.id} className="list-item">
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="title">{e.nombre || 'Sin nombre'}{e.cambio ? ' · cambio' : ''}</span><br />
                    <span className="subtle ellipsis" style={{ display: 'block' }}>{e.items.map((i) => `${i.nombre}${i.libre ? '' : ` (${i.talle})`}`).join(', ')}</span>
                    <span className="subtle">{fechaRelativa(e.creado)} · {money(total(e))}</span>
                  </span>
                  <button className="btn btn-primary btn-sm" onClick={async () => { await cart.retomar(e.id); setAbierta(false); toast('Venta retomada') }}><PlayCircle /> Retomar</button>
                  <button className="icon-btn" onClick={async () => { await db.esperas.delete(e.id); toast('Venta en espera descartada') }} aria-label={`Descartar venta en espera ${e.nombre || ''}`}><X /></button>
                </div>
              ))}
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}

function PickSheet({ p, onClose }) {
  const cart = useCart()
  const cfg = useConfig()
  const toast = useToast()
  const colores = useMemo(() => [...new Set(p.variantes.map((v) => v.color || ''))], [p])
  const [color, setColor] = useState(() => colores.find((c) => p.variantes.some((v) => (v.color || '') === c && v.stock > 0)) ?? colores[0])
  const [sel, setSel] = useState(null)
  const enCarrito = (vid) => cart.items.find((i) => i.varianteId === vid)?.cantidad || 0
  const items = p.variantes
    .filter((v) => (v.color || '') === color)
    .map((v) => ({ key: v.id, talle: v.talle, color: v.color, stock: v.stock - enCarrito(v.id), v }))
  const elegido = items.find((i) => i.key === sel)

  const agregar = () => {
    const v = elegido.v
    cart.add(lineaCarrito(p, v))
    toast(`${p.nombre} · ${v.talle} al carrito`)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Elegí talle">
      <div className="stack" style={{ gap: 18 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="line-thumb" style={{ width: 72, height: 90 }}><ProductImg producto={p} /></div>
          <div className="grow">
            <p style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>{p.nombre}</p>
            <p className="subtle">{p.categoria}</p>
            <p className="ptag-price" style={{ marginTop: 4 }}>{money(p.precio)}</p>
          </div>
        </div>
        {colores.length > 1 && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="label">Color</span>
            <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }}>
              {colores.map((c) => (
                <button key={c} className="chip" aria-pressed={c === color} onClick={() => { setColor(c); setSel(null) }}>
                  <span className="color-dot" style={{ background: colorHex(c) }} />{c || 'Sin color'}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Talle {colores.length === 1 && colores[0] ? `· ${colores[0]}` : ''}</span>
          <Rack items={items} stockBajo={cfg?.stockBajo} selected={sel} onPick={(it) => setSel(it.key)} />
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={!elegido} onClick={agregar}>
          <ShoppingBag /> {elegido ? `Agregar talle ${elegido.talle}` : 'Tocá una percha para elegir el talle'}
        </button>
      </div>
    </Sheet>
  )
}

/** Banner cuando la venta en curso es un cambio de prendas. */
export function CambioBanner() {
  const cart = useCart()
  if (!cart.cambio) return null
  const c = cart.cambio
  return (
    <div className="alert alert-rose">
      <Repeat />
      <span className="grow">
        <b>Cambio de la venta #{c.ventaId}.</b> Vuelve{c.items.length > 1 ? 'n' : ''} {c.items.map((i) => `${i.nombre} (${i.talle})`).join(', ')}.
        {c.resto > 0 ? <> Tiene <b>{money(c.resto)}</b> a favor para esta compra.</> : ' Lo que debía de esa venta baja solo.'}
      </span>
      <button className="icon-btn" style={{ color: 'inherit' }} onClick={() => cart.setCambio(null)} aria-label="Cancelar el cambio"><X /></button>
    </div>
  )
}

export default function Vender() {
  const productos = useProductosConStock()
  const cart = useCart()
  const toast = useToast()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todas')
  const [pick, setPick] = useState(null)
  const [escanear, setEscanear] = useState(false)

  /** Suma una variante por su id (QR de la etiqueta o código tipeado). */
  const agregarVariante = useCallback((vid) => {
    const p = productos?.find((x) => x.variantes.some((v) => v.id === vid))
    const v = p?.variantes.find((x) => x.id === vid)
    if (!v) { toast('Ese código no corresponde a ninguna prenda a la venta.', 'error'); return false }
    const enCarrito = cart.items.find((i) => i.varianteId === vid)?.cantidad || 0
    if (v.stock - enCarrito <= 0) { toast(`${p.nombre} talle ${v.talle}: sin stock.`, 'error'); return false }
    cart.add(lineaCarrito(p, v))
    toast(`${p.nombre} · ${v.talle} al carrito`)
    return true
  }, [productos, cart, toast])

  // Link de la etiqueta QR: #/vender?v=123
  const vParam = sp.get('v')
  useEffect(() => {
    if (!vParam || !productos) return
    agregarVariante(Number(vParam))
    setSp({}, { replace: true })
  }, [vParam, productos]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDetect = useCallback((texto) => {
    setEscanear(false)
    const vid = leerCodigo(texto)
    if (vid) agregarVariante(vid)
    else toast('Ese QR no es de una etiqueta de la tienda.', 'error')
  }, [agregarVariante, toast])

  const buscarCodigo = (e) => {
    if (e.key !== 'Enter') return
    const vid = /^v?\d+$/i.test(q.trim()) ? leerCodigo(q) : null
    if (vid && agregarVariante(vid)) setQ('')
  }

  const lista = useMemo(() => {
    if (!productos) return []
    const t = q.trim().toLowerCase()
    return productos.filter((p) => (cat === 'Todas' || p.categoria === cat) && (!t || p.nombre.toLowerCase().includes(t)))
  }, [productos, q, cat])
  const cats = useMemo(() => ['Todas', ...CATEGORIAS.filter((c) => productos?.some((p) => p.categoria === c))], [productos])

  return (
    <Page title="Nueva venta" wide>
      <div className="sell-layout">
        <div className="stack">
          <CambioBanner />
          <EsperasBar />
          <div className="row">
            <label className="search grow">
              <Search />
              <span className="sr-only">Buscar prenda o código</span>
              <input className="input" type="search" placeholder="Buscar prenda o código…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={buscarCodigo} />
            </label>
            {puedeEscanear() && <button className="btn btn-soft" onClick={() => setEscanear(true)} aria-label="Escanear etiqueta"><ScanLine /></button>}
          </div>
          <div className="chips" role="group" aria-label="Categorías">
            {cats.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          {productos && !productos.length ? (
            <Empty art={<EmptyRackArt />} title="El perchero está vacío" text="Cargá tus prendas con sus talles y colores para empezar a vender." action={<Link className="btn btn-primary" to="/stock/nuevo"><Plus /> Cargar prenda</Link>} />
          ) : !lista.length && productos ? (
            <Empty title="No hay prendas con ese nombre" text="Probá con otra palabra o elegí “Todas”." />
          ) : (
            <div className="tag-grid">
              {lista.map((p) => (
                <ProductTag key={p.id} p={p} onClick={p.stock > 0 ? () => setPick(p) : undefined}>
                  {p.stock > 0 ? <span className="subtle num">{p.stock} u.</span> : <span className="badge badge-muted">agotado</span>}
                </ProductTag>
              ))}
            </div>
          )}
        </div>

        <aside className="cart-side">
          <Tag string>
            <div className="stack">
              <h2 className="section-title">Venta actual</h2>
              {cart.items.length ? (
                <>
                  <CartLines />
                  <div className="totals"><div className="row-between grand"><span>Total</span><b>{money(cart.subtotal)}</b></div></div>
                  <button className="btn btn-primary btn-lg btn-block" onClick={() => nav('/vender/cobrar')}>Cobrar</button>
                </>
              ) : <p className="muted">Tocá una prenda y elegí el talle en el perchero.</p>}
              <CartTools />
            </div>
          </Tag>
        </aside>
      </div>

      {cart.count > 0 && (
        <div className="cartbar">
          <span className="count num">{cart.count}</span>
          <span className="grow"><span className="subtle" style={{ color: 'var(--rose-200)' }}>Total</span><br /><span className="total">{money(cart.subtotal)}</span></span>
          <button className="btn" onClick={() => nav('/vender/cobrar')}>Cobrar</button>
        </div>
      )}

      {pick && <PickSheet p={pick} onClose={() => setPick(null)} />}
      {escanear && <Escaner onDetect={onDetect} onClose={() => setEscanear(false)} />}
    </Page>
  )
}
