import { useMemo, useState } from 'react'
import { CartCtx } from './store'

/**
 * Carrito de la venta en curso.
 * cambio: { ventaId, lineas:[{idx,cantidad}], items, resto, clientaId } cuando la venta es un cambio de prendas.
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [cambio, setCambio] = useState(null)

  const api = useMemo(() => ({
    items,
    cambio,
    count: items.reduce((s, i) => s + i.cantidad, 0),
    subtotal: items.reduce((s, i) => s + i.precio * i.cantidad, 0),
    add(item) {
      setItems((prev) => {
        const i = prev.findIndex((p) => p.varianteId === item.varianteId)
        if (i >= 0) {
          const next = [...prev]
          next[i] = { ...next[i], cantidad: Math.min(next[i].cantidad + 1, item.max ?? 999) }
          return next
        }
        return [...prev, { ...item, cantidad: 1 }]
      })
    },
    setQty(varianteId, cantidad) {
      setItems((prev) => prev
        .map((p) => (p.varianteId === varianteId ? { ...p, cantidad: Math.min(cantidad, p.max ?? 999) } : p))
        .filter((p) => p.cantidad > 0))
    },
    setCambio,
    clear() { setItems([]); setCambio(null) },
  }), [items, cambio])

  return <CartCtx.Provider value={api}>{children}</CartCtx.Provider>
}
