import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { startOfDay, endOfDay } from './utils'

/** Inicio y fin del día de hoy; se actualiza solo si la app queda abierta pasada la medianoche. */
export function useHoy() {
  const [desde, setDesde] = useState(() => startOfDay())
  useEffect(() => {
    const check = () => setDesde(startOfDay())
    const t = setInterval(check, 60000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', check) }
  }, [])
  return { desde, hasta: endOfDay(desde) }
}

/** Momento en que se montó el componente (para cálculos de "hace N días" sin llamar Date.now en el render). */
export function useAhora() {
  const [ahora] = useState(() => Date.now())
  return ahora
}

/** URL mostrable para una foto guardada como Blob (o dataURL de datos viejos). */
export function useFotoUrl(foto) {
  const url = useMemo(() => (foto instanceof Blob ? URL.createObjectURL(foto) : foto || null), [foto])
  useEffect(() => () => { if (foto instanceof Blob && url) URL.revokeObjectURL(url) }, [url, foto])
  return url
}

export function useProductosConStock() {
  return useLiveQuery(async () => {
    const [productos, variantes] = await Promise.all([db.productos.toArray(), db.variantes.toArray()])
    const byProd = {}
    variantes.forEach((v) => { (byProd[v.productoId] ||= []).push(v) })
    return productos
      .filter((p) => p.activo !== 0)
      .map((p) => ({ ...p, variantes: byProd[p.id] || [], stock: (byProd[p.id] || []).reduce((s, v) => s + v.stock, 0) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [])
}

/** Última venta por producto (para detectar prendas quietas). */
export function useUltimaVentaPorProducto() {
  return useLiveQuery(async () => {
    const map = {}
    await db.ventas.each((v) => {
      if (v.anulada) return
      v.items.forEach((i) => { if (i.productoId && (map[i.productoId] || 0) < v.fecha) map[i.productoId] = v.fecha })
    })
    return map
  }, [])
}
