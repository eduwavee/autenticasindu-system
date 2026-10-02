import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Store, Undo2 } from 'lucide-react'
import { db, METODO_LABEL, CANALES } from '../db'
import { Page } from '../layout'
import { Empty } from '../ui'
import { money, periodo, fecha, hora, descargar, initials } from '../utils'

const PERIODOS = [['hoy', 'Hoy'], ['semana', '7 días'], ['mes', 'Este mes'], ['mesAnterior', 'Mes anterior']]

export default function Ventas() {
  const [per, setPer] = useState('hoy')
  const [filtro, setFiltro] = useState('todas')
  const { desde, hasta } = periodo(per)
  const data = useLiveQuery(async () => {
    const [ventas, clientas] = await Promise.all([db.ventas.where('fecha').between(desde, hasta, true, true).reverse().sortBy('fecha'), db.clientas.toArray()])
    const cMap = Object.fromEntries(clientas.map((c) => [c.id, c]))
    return ventas.map((v) => ({ ...v, clienta: cMap[v.clientaId] }))
  }, [desde, hasta])

  const lista = useMemo(() => (data || []).filter((v) =>
    filtro === 'todas' ? true
      : filtro === 'debe' ? v.saldo > 0 && !v.anulada
        : filtro === 'apartadas' ? !v.entregada && !v.anulada
          : filtro === 'devueltas' ? v.devuelto > 0 && !v.anulada
            : v.anulada), [data, filtro])
  const total = lista.filter((v) => !v.anulada).reduce((s, v) => s + v.total - (v.devuelto || 0), 0)

  // agrupar por día
  const grupos = useMemo(() => {
    const g = []
    lista.forEach((v) => {
      const k = fecha(v.fecha)
      if (!g.length || g[g.length - 1].k !== k) g.push({ k, items: [] })
      g[g.length - 1].items.push(v)
    })
    return g
  }, [lista])

  const exportarCSV = () => {
    const rows = [['Nro', 'Fecha', 'Hora', 'Clienta', 'Canal', 'Prendas', 'Subtotal', 'Descuento', 'Recargo', 'Total', 'Pagos', 'Devuelto', 'Saldo', 'Estado']]
    lista.forEach((v) => rows.push([
      v.id, new Date(v.fecha).toLocaleDateString('es-AR'), hora(v.fecha), v.clienta?.nombre || '', v.canal,
      v.items.map((i) => `${i.nombre} ${i.talle} x${i.cantidad}`).join(' | '), v.subtotal, v.descuento, v.recargo, v.total,
      v.pagos.map((p) => `${METODO_LABEL[p.metodo]} ${p.monto}`).join(' | '), v.devuelto || 0, v.saldo, v.estado,
    ]))
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    descargar(`ventas-${per}.csv`, '﻿' + csv, 'text/csv')
  }

  return (
    <Page title="Ventas" back="/mas" actions={<>
      <Link className="icon-btn" to="/ventas/devoluciones" aria-label="Devoluciones y anulaciones" title="Devoluciones y anulaciones"><Undo2 /></Link>
      <button className="icon-btn" onClick={exportarCSV} aria-label="Exportar a Excel (CSV)" title="Exportar CSV"><Download /></button>
    </>}>
      <div className="stack">
        <div className="seg" role="group" aria-label="Período">
          {PERIODOS.map(([id, l]) => <button key={id} aria-pressed={per === id} onClick={() => setPer(id)}>{l}</button>)}
        </div>
        <div className="chips" role="group" aria-label="Filtro">
          {[['todas', 'Todas'], ['debe', 'Con saldo'], ['apartadas', 'Apartadas'], ['devueltas', 'Con devoluciones'], ['anuladas', 'Anuladas']].map(([id, l]) => (
            <button key={id} className="chip" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{l}</button>
          ))}
        </div>
        <div className="row-between"><span className="muted">{lista.length} {lista.length === 1 ? 'venta' : 'ventas'}</span><b className="money">{money(total)}</b></div>
        {data && !lista.length ? (
          <Empty title="Sin ventas en este período" text="Probá con otro período o filtro." />
        ) : grupos.map((g) => (
          <section key={g.k} className="stack" style={{ gap: 8 }}>
            <h2 className="subtle" style={{ fontWeight: 700, textTransform: 'capitalize' }}>{g.k}</h2>
            <div className="list">
              {g.items.map((v) => (
                <Link key={v.id} to={`/ventas/${v.id}`} className="list-item" style={v.anulada ? { opacity: 0.55 } : undefined}>
                  <span className="avatar">{v.clienta ? initials(v.clienta.nombre) : <Store size={18} />}</span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="title ellipsis" style={{ display: 'block' }}>{v.items.map((i) => i.nombre).join(', ')}</span>
                    <span className="subtle">#{v.id} · {hora(v.fecha)} · {CANALES.find((c) => c.id === v.canal)?.label} · {v.pagos.map((p) => METODO_LABEL[p.metodo]).join(' + ') || 'A cuenta'}{v.cambioDe ? ' · cambio' : ''}</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <b className="money" style={v.anulada ? { textDecoration: 'line-through' } : undefined}>{money(v.total)}</b><br />
                    {v.anulada ? <span className="badge badge-muted">anulada</span> : v.estado === 'devuelta' ? <span className="badge badge-muted">devuelta</span> : v.devuelto > 0 ? <span className="badge badge-muted">devolvió {money(v.devuelto)}</span> : v.saldo > 0 ? <span className="badge badge-bad">debe {money(v.saldo)}</span> : !v.entregada ? <span className="badge badge-warn">apartada</span> : null}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Page>
  )
}
