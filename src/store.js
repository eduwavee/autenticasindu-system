import { createContext, useContext, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, CONFIG_DEFAULT } from './db'

export function useConfig() {
  const rows = useLiveQuery(() => db.config.toArray(), [])
  return useMemo(() => {
    if (!rows) return null
    const cfg = { ...CONFIG_DEFAULT }
    rows.forEach((r) => { cfg[r.key] = r.value })
    return cfg
  }, [rows])
}

export const CartCtx = createContext(null)
export const useCart = () => useContext(CartCtx)

/** Clave de cada línea del carrito: la variante, o un id propio para los ítems libres (sin stock). */
export const claveLinea = (i) => i.key || (i.varianteId ? `v${i.varianteId}` : `l${i.libreId}`)
