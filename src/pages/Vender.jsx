import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Plus, Minus, ShoppingBag, Check, Trash2, ScanLine, Repeat, X } from 'lucide-react'
import { CATEGORIAS } from '../db'
import { useCart, useConfig } from '../store'
import { useProductosConStock } from '../hooks'
import { Page } from '../layout'
import { Tag, Rack, Sheet, ProductImg, Empty, EmptyRackArt, useToast } from '../ui'
import { money, colorHex, leerCodigo } from '../utils'
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

export function CartLines({ editable = true }) {
  const cart = useCart()
  return (
    <div>
      {cart.items.map((i) => (
        <div className="line" key={i.varianteId}>
          <div className="line-thumb"><ProductImg producto={i} /></div>
          <div className="grow">
            <div style={{ fontWeight: 600 }} className="ellipsis">{i.nombre}</div>
            <div className="subtle">Talle {i.talle}{i.color ? ` · ${i.color}` : ''} · {money(i.precio)}</div>
          </div>
          {editable ? (
            <div className="qty" aria-label={`Cantidad de ${i.nombre}`}>
              <button onClick={() => cart.setQty(i.varianteId, i.cantidad - 1)} aria-label="Quitar uno">{i.cantidad === 1 ? <Trash2 /> : <Minus />}</button>
              <span>{i.cantidad}</span>
              <button onClick={() => cart.setQty(i.varianteId, i.cantidad + 1)} disabled={i.cantidad >= i.max} aria-label="Agregar uno"><Plus /></button>
            </div>
          ) : <span className="num">×{i.cantidad}</span>}
        </div>
      ))}
    </div>
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
