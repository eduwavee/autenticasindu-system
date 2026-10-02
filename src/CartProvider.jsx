import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from './db'
import { CartCtx, claveLinea } from './store'

const LS_KEY = 'autenticas:carrito'

/** Lo que se guarda: sin la foto (es un Blob y se busca por productoId al mostrar). */
const sinFoto = (items) => items.map(({ foto: _f, ...i }) => i)

function leerGuardado() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const d = raw ? JSON.parse(raw) : null
    return { items: Array.isArray(d?.items) ? d.items : [], cambio: d?.cambio || null }
  } catch { return { items: [], cambio: null } }
}

/**
 * Carrito de la venta en curso. Se guarda en el dispositivo, así no se pierde si se cierra la app.
 * cambio: { ventaId, lineas:[{idx,cantidad}], items, resto, clientaId, motivo } cuando la venta es un cambio de prendas.
 * Las ventas en espera se guardan en la tabla `esperas`.
 */
export function CartProvider({ children }) {
  const [inicial] = useState(leerGuardado)
  const [items, setItems] = useState(inicial.items)
  const [cambio, setCambio] = useState(inicial.cambio)

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ items: sinFoto(items), cambio })) } catch { /* sin almacenamiento: el carrito vive solo en memoria */ }
  }, [items, cambio])

  const ponerEnEspera = useCallback(async (nombre) => {
    if (!items.length) return null
    const id = await db.esperas.add({ creado: Date.now(), nombre: nombre?.trim() || '', items: sinFoto(items), cambio })
    setItems([]); setCambio(null)
    return id
  }, [items, cambio])

  const retomar = useCallback(async (id) => {
    const e = await db.esperas.get(id)
    if (!e) return
    // Si había una venta a medias, queda en espera en su lugar.
    if (items.length) await db.esperas.add({ creado: Date.now(), nombre: '', items: sinFoto(items), cambio })
    await db.esperas.delete(id)
    // El stock pudo cambiar mientras esperaba: se ajusta el máximo de cada línea.
    const vars = await db.variantes.bulkGet(e.items.map((i) => i.varianteId || 0))
    setItems(e.items.map((i, k) => (i.varianteId && vars[k] ? { ...i, max: vars[k].stock, cantidad: Math.min(i.cantidad, Math.max(vars[k].stock, 1)) } : i)))
    setCambio(e.cambio || null)
  }, [items, cambio])

  const api = useMemo(() => ({
    items,
    cambio,
    count: items.reduce((s, i) => s + i.cantidad, 0),
    subtotal: items.reduce((s, i) => s + i.precio * i.cantidad, 0),
    add(item) {
      setItems((prev) => {
        const k = claveLinea(item)
        const i = prev.findIndex((p) => claveLinea(p) === k)
        if (i >= 0) {
          const next = [...prev]
          next[i] = { ...next[i], cantidad: Math.min(next[i].cantidad + 1, item.max ?? 999) }
          return next
        }
        return [...prev, { ...item, key: k, precioLista: item.precioLista ?? item.precio, cantidad: 1 }]
      })
    },
    /** Ítem que no está en el stock (arreglo, bolsa, prenda sin cargar). */
    addLibre(nombre, precio) {
      const libreId = Date.now()
      setItems((prev) => [...prev, { key: `l${libreId}`, libreId, productoId: null, varianteId: null, nombre, talle: '—', color: '', precio, precioLista: precio, costo: 0, categoria: 'Otros', cantidad: 1, libre: true }])
    },
    setQty(key, cantidad) {
      setItems((prev) => prev
        .map((p) => (claveLinea(p) === key ? { ...p, cantidad: Math.min(cantidad, p.max ?? 999) } : p))
        .filter((p) => p.cantidad > 0))
    },
    /** Precio especial para una línea (queda registrado el precio de lista). */
    setPrecio(key, precio) {
      setItems((prev) => prev.map((p) => (claveLinea(p) === key ? { ...p, precio: Math.max(0, Number(precio) || 0) } : p)))
    },
    setCambio,
    ponerEnEspera,
    retomar,
    clear() { setItems([]); setCambio(null) },
  }), [items, cambio, ponerEnEspera, retomar])

  return <CartCtx.Provider value={api}>{children}</CartCtx.Provider>
}
