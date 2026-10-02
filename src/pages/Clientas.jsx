import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, UserPlus, ChevronRight } from 'lucide-react'
import { db, deudaPorClienta, creditosPorClienta, TALLES_SUGERIDOS } from '../db'
import { Page } from '../layout'
import { Sheet, Empty, useToast } from '../ui'
import { useAhora } from '../hooks'
import { money, initials, diasDesde, diasParaCumple, textoCumpleCorto, MESES } from '../utils'

/** Días sin comprar a partir de los cuales una clienta se considera inactiva. */
const DIAS_INACTIVA = 60

export function ClientaForm({ open, onClose, inicial, onSaved }) {
  const toast = useToast()
  const [c, setC] = useState(inicial || { nombre: '', telefono: '', instagram: '', notas: '', talle: '', cumple: '' })
  const [err, setErr] = useState('')
  const [cm, cd] = (c.cumple || '').split('-')
  const setCumple = (mes, dia) => setC({ ...c, cumple: mes && dia ? `${mes}-${dia}` : mes || dia ? `${mes || ''}-${dia || ''}` : '' })
  const guardar = async () => {
    if (!c.nombre.trim()) { setErr('Poné el nombre.'); return }
    const cumple = /^\d{2}-\d{2}$/.test(c.cumple || '') ? c.cumple : ''
    const data = { nombre: c.nombre.trim(), telefono: (c.telefono || '').trim(), instagram: (c.instagram || '').replace('@', '').trim(), notas: c.notas || '', talle: (c.talle || '').trim().toUpperCase(), cumple }
    let id = c.id
    if (id) await db.clientas.update(id, data)
    else id = await db.clientas.add({ ...data, creado: Date.now() })
    toast(c.id ? 'Clienta actualizada' : 'Clienta agregada')
    onSaved?.(id)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={c.id ? 'Editar clienta' : 'Nueva clienta'}>
      <div className="stack">
        <label className="field"><span>Nombre</span><input className="input" value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} aria-invalid={!!err} />{err && <span className="field-error">{err}</span>}</label>
        <label className="field"><span>WhatsApp</span><input className="input" inputMode="tel" placeholder="381 555 0000" value={c.telefono} onChange={(e) => setC({ ...c, telefono: e.target.value })} /></label>
        <label className="field"><span>Instagram</span><input className="input" placeholder="usuaria" value={c.instagram} onChange={(e) => setC({ ...c, instagram: e.target.value })} /></label>
        <div className="grid-2">
          <label className="field"><span>Talle habitual</span>
            <input className="input" list="talles-sugeridos" placeholder="M, 38…" value={c.talle || ''} onChange={(e) => setC({ ...c, talle: e.target.value })} />
            <datalist id="talles-sugeridos">{TALLES_SUGERIDOS.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <div className="field"><span>Cumpleaños</span>
            <div className="row" style={{ gap: 6 }}>
              <select className="select" value={cd || ''} onChange={(e) => setCumple(cm, e.target.value)} aria-label="Día del cumpleaños">
                <option value="">Día</option>{Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
              </select>
              <select className="select" value={cm || ''} onChange={(e) => setCumple(e.target.value, cd)} aria-label="Mes del cumpleaños">
                <option value="">Mes</option>{MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>
        <label className="field"><span>Notas</span><textarea className="textarea" placeholder="Gustos, cómo le queda cada marca…" value={c.notas} onChange={(e) => setC({ ...c, notas: e.target.value })} /></label>
        <button className="btn btn-primary btn-block" onClick={guardar}>Guardar</button>
      </div>
    </Sheet>
  )
}

export default function Clientas() {
  const [sp, setSp] = useSearchParams()
  const filtro = sp.get('filtro') || 'todas'
  const [q, setQ] = useState('')
  const [nueva, setNueva] = useState(false)
  const nav = useNavigate()
  const ahora = useAhora()

  const data = useLiveQuery(async () => {
    const [clientas, deudas, creditos, ventas] = await Promise.all([db.clientas.toArray(), deudaPorClienta(), creditosPorClienta(), db.ventas.toArray()])
    const compras = {}, ultima = {}
    ventas.forEach((v) => {
      if (!v.clientaId || v.anulada) return
      compras[v.clientaId] = (compras[v.clientaId] || 0) + v.total - (v.devuelto || 0)
      ultima[v.clientaId] = Math.max(ultima[v.clientaId] || 0, v.fecha)
    })
    return clientas.map((c) => ({ ...c, deuda: deudas[c.id] || 0, credito: creditos[c.id] || 0, comprado: compras[c.id] || 0, ultima: ultima[c.id] || null }))
  }, [])

  const lista = useMemo(() => {
    if (!data) return []
    const t = q.trim().toLowerCase()
    let l = data.filter((c) => !t || c.nombre.toLowerCase().includes(t) || (c.telefono || '').includes(t))
    if (filtro === 'deben') l = l.filter((c) => c.deuda > 0).sort((a, b) => b.deuda - a.deuda)
    else if (filtro === 'afavor') l = l.filter((c) => c.credito > 0).sort((a, b) => b.credito - a.credito)
    else if (filtro === 'top') l = [...l].sort((a, b) => b.comprado - a.comprado)
    else if (filtro === 'cumple') l = l.map((c) => ({ ...c, faltan: diasParaCumple(c.cumple, new Date(ahora)) })).filter((c) => c.faltan !== null && c.faltan <= 30).sort((a, b) => a.faltan - b.faltan)
    else if (filtro === 'inactivas') l = l.filter((c) => c.ultima && diasDesde(c.ultima, ahora) >= DIAS_INACTIVA).sort((a, b) => a.ultima - b.ultima)
    else l = [...l].sort((a, b) => a.nombre.localeCompare(b.nombre))
    return l
  }, [data, q, filtro, ahora])

  const subtitulo = (c) => {
    if (filtro === 'top') return `Compró ${money(c.comprado)}`
    if (filtro === 'afavor') return `Tiene ${money(c.credito)} a favor`
    if (filtro === 'cumple') return c.faltan === 0 ? '¡Cumple hoy! 🎂' : `Cumple el ${textoCumpleCorto(c.cumple)} · en ${c.faltan} ${c.faltan === 1 ? 'día' : 'días'}`
    if (filtro === 'inactivas') return `Última compra hace ${diasDesde(c.ultima, ahora)} días${c.talle ? ` · talle ${c.talle}` : ''}`
    return c.telefono || (c.instagram ? '@' + c.instagram : 'Sin contacto')
  }
  const vacio = {
    deben: ['Nadie te debe nada', 'Todas las cuentas están al día.'],
    afavor: ['Nadie tiene saldo a favor', 'Acá aparecen las señas y devoluciones que quedaron a cuenta.'],
    cumple: ['Sin cumpleaños cerca', 'Cargá el cumpleaños en la ficha de cada clienta para saludarla.'],
    inactivas: ['Todas compraron hace poco', `Acá aparecen las que llevan más de ${DIAS_INACTIVA} días sin comprar.`],
  }[filtro] || ['Sin resultados', 'Probá con otro nombre.']
  const totalDeuda = (data || []).reduce((s, c) => s + c.deuda, 0)

  return (
    <Page title="Clientas" actions={<button className="btn btn-sm btn-soft" style={{ background: '#fff' }} onClick={() => setNueva(true)}><UserPlus /> Nueva</button>}>
      <div className="stack">
        <label className="search"><Search /><span className="sr-only">Buscar clienta</span><input className="input" type="search" placeholder="Nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="chips" role="group" aria-label="Filtro">
          {[['todas', 'Todas'], ['deben', 'Me deben'], ['afavor', 'Saldo a favor'], ['cumple', 'Cumpleaños'], ['inactivas', 'Hace rato no compran'], ['top', 'Mejores clientas']].map(([id, l]) => (
            <button key={id} className="chip" aria-pressed={filtro === id} onClick={() => setSp(id === 'todas' ? {} : { filtro: id }, { replace: true })}>{l}</button>
          ))}
        </div>
        {filtro === 'deben' && totalDeuda > 0 && <div className="alert alert-rose"><span className="grow">Total en la calle</span><b className="money">{money(totalDeuda)}</b></div>}
        {data && !data.length ? (
          <Empty title="Sin clientas todavía" text="Guardá a tus clientas para llevar sus compras, fiados y señas, y escribirles por WhatsApp." action={<button className="btn btn-primary" onClick={() => setNueva(true)}><UserPlus /> Agregar clienta</button>} />
        ) : data && !lista.length ? (
          <Empty title={vacio[0]} text={vacio[1]} />
        ) : (
          <div className="list">
            {lista.map((c) => (
              <Link key={c.id} to={`/clientas/${c.id}`} className="list-item">
                <span className="avatar">{initials(c.nombre)}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="title ellipsis" style={{ display: 'block' }}>{c.nombre}</span>
                  <span className="subtle">{subtitulo(c)}</span>
                </span>
                {c.deuda > 0 ? <span className="badge badge-bad">debe {money(c.deuda)}</span> : c.credito > 0 ? <span className="badge badge-ok">a favor {money(c.credito)}</span> : null}
                <ChevronRight className="chev" />
              </Link>
            ))}
          </div>
        )}
      </div>
      {nueva && <ClientaForm open onClose={() => setNueva(false)} onSaved={(id) => nav(`/clientas/${id}`)} />}
    </Page>
  )
}
