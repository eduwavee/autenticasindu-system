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
