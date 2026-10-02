import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Lock } from 'lucide-react'
import { db, METODOS, METODO_LABEL, CATEGORIAS_GASTO, getFondo, setFondo } from '../db'
import { useHoy } from '../hooks'
import { Page } from '../layout'
import { Tag, Sheet, Confirm, MoneyInput, Empty, useToast } from '../ui'
import { money, periodo, fechaRelativa, fechaLarga, hoyISO, dateAIso, ahora } from '../utils'

function GastoForm({ open, onClose }) {
  const toast = useToast()
  const [g, setG] = useState({ categoria: 'Mercadería', descripcion: '', monto: '', metodo: 'efectivo', dia: hoyISO() })
  const guardar = async () => {
    if (!(Number(g.monto) > 0)) return
    const [y, m, d] = g.dia.split('-').map(Number)
    const f = new Date(y, m - 1, d, new Date().getHours(), new Date().getMinutes())
    await db.gastos.add({ fecha: f.getTime(), categoria: g.categoria, descripcion: g.descripcion.trim() || g.categoria, monto: Number(g.monto), metodo: g.metodo })
    toast('Gasto anotado')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Anotar gasto">
      <div className="stack">
        <label className="field"><span>Monto</span><MoneyInput value={g.monto} onChange={(v) => setG({ ...g, monto: v })} autoFocus /></label>
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Categoría</span>
          <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }}>
            {CATEGORIAS_GASTO.map((c) => <button key={c} className="chip" aria-pressed={g.categoria === c} onClick={() => setG({ ...g, categoria: c })}>{c}</button>)}
          </div>
        </div>
        <label className="field"><span>Detalle</span><input className="input" placeholder="Ej: compra a proveedor" value={g.descripcion} onChange={(e) => setG({ ...g, descripcion: e.target.value })} /></label>
        <div className="grid-2">
          <label className="field"><span>Pagado con</span>
            <select className="select" value={g.metodo} onChange={(e) => setG({ ...g, metodo: e.target.value })}>{METODOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
          </label>
          <label className="field"><span>Día</span><input type="date" className="input" value={g.dia} max={hoyISO()} onChange={(e) => setG({ ...g, dia: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={!(Number(g.monto) > 0)} onClick={guardar}>Guardar gasto</button>
      </div>
    </Sheet>
  )
}

/** Arqueo de efectivo. Se monta cuando ya se leyó el fondo guardado, así arranca con ese valor. */
function Arqueo({ dia, fondoInicial, efectivo, gastosEf, entradas, salidas, por, cierre }) {
  const toast = useToast()
  const [fondo, setFondoLocal] = useState(fondoInicial)
  const [contado, setContado] = useState('')
  const [nota, setNota] = useState('')
  const esperado = (Number(fondo) || 0) + efectivo - gastosEf
  const dif = contado === '' ? null : Number(contado) - esperado

  const cerrar = async () => {
    await db.cierres.add({ fecha: ahora(), fondo: Number(fondo) || 0, efectivo, gastosEfectivo: gastosEf, esperado, contado: Number(contado), diferencia: dif, entradas, salidas, porMetodo: por, nota: nota.trim() })
    toast('Caja cerrada')
    setContado(''); setNota('')
  }

  return (
    <section className="panel panel-pad stack">
      <h2 className="section-title">Arqueo de efectivo</h2>
      {cierre && (
        <div className="alert alert-rose"><Lock /><span>Ya cerraste la caja hoy ({fechaRelativa(cierre.fecha)}) con {cierre.diferencia === 0 ? 'la caja justa' : `diferencia de ${money(cierre.diferencia)}`}. Podés volver a cerrarla si hubo más ventas.</span></div>
      )}
      <label className="field"><span>Fondo con el que abriste</span>
        <MoneyInput value={fondo} onChange={setFondoLocal} onBlur={() => setFondo(dia, fondo)} />
      </label>
      <div className="totals">
        <div className="row-between"><span className="muted">Fondo inicial</span><b>{money(Number(fondo) || 0)}</b></div>
        <div className="row-between"><span className="muted">{efectivo < 0 ? '− Devuelto en efectivo (neto)' : '+ Efectivo neto del día'}</span><b>{money(Math.abs(efectivo))}</b></div>
        <div className="row-between"><span className="muted">− Gastos en efectivo</span><b>{money(gastosEf)}</b></div>
        <div className="row-between grand"><span>Debería haber</span><b>{money(esperado)}</b></div>
      </div>
      <label className="field"><span>¿Cuánto contaste?</span><MoneyInput value={contado} onChange={setContado} /></label>
      {dif !== null && (
        <p className={`badge ${dif === 0 ? 'badge-ok' : dif > 0 ? 'badge-warn' : 'badge-bad'}`} style={{ alignSelf: 'flex-start', fontSize: 'var(--fs-sm)', padding: '6px 12px' }}>
          {dif === 0 ? 'La caja da justa' : dif > 0 ? `Sobran ${money(dif)}` : `Faltan ${money(-dif)}`}
        </p>
      )}
      <label className="field"><span>Nota (opcional)</span><input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: retiré $20.000 para el proveedor" /></label>
      <button className="btn btn-primary btn-block" disabled={contado === ''} onClick={() => { setFondo(dia, fondo); cerrar() }}><Lock /> Cerrar caja</button>
    </section>
  )
}

function CajaHoy({ onGasto }) {
  const { desde, hasta } = useHoy()
  const dia = dateAIso(desde)
  const data = useLiveQuery(async () => {
    const [cobros, gastos, cierre, fondo] = await Promise.all([
      db.cobros.where('fecha').between(desde, hasta, true, true).toArray(),
      db.gastos.where('fecha').between(desde, hasta, true, true).toArray(),
      db.cierres.where('fecha').between(desde, hasta, true, true).last(),
      getFondo(dia),
    ])
    return { cobros, gastos, cierre, fondo }
  }, [desde, hasta, dia])

  if (!data) return null
  const por = {}
  data.cobros.forEach((c) => { por[c.metodo] = (por[c.metodo] || 0) + c.monto })
  const entradas = data.cobros.filter((c) => c.monto > 0).reduce((s, c) => s + c.monto, 0)
  const salidas = data.cobros.filter((c) => c.monto < 0).reduce((s, c) => s - c.monto, 0)
  const gastosEf = data.gastos.filter((g) => g.metodo === 'efectivo').reduce((s, g) => s + g.monto, 0)
  const gastosTot = data.gastos.reduce((s, g) => s + g.monto, 0)

  return (
    <div className="stack-lg">
      <Tag string>
        <p className="label">{fechaLarga(desde)}</p>
        <div className="totals" style={{ marginTop: 10, fontSize: 'var(--fs-base)' }}>
          {METODOS.map((m) => <div key={m.id} className="row-between"><span className="muted">{m.label}</span><b>{money(por[m.id] || 0)}</b></div>)}
          <div className="row-between grand"><span>Entró hoy</span><b>{money(entradas)}</b></div>
          {salidas > 0 && <div className="row-between" style={{ color: 'var(--bad)' }}><span>Devoluciones de plata</span><b>−{money(salidas)}</b></div>}
          <div className="row-between" style={{ color: 'var(--bad)' }}><span>Gastos de hoy</span><b>−{money(gastosTot)}</b></div>
          <div className="row-between"><span style={{ fontWeight: 700 }}>Queda del día</span><b style={{ fontSize: 'var(--fs-md)' }}>{money(entradas - salidas - gastosTot)}</b></div>
        </div>
      </Tag>

      <section className="stack">
        <div className="section-head"><h2 className="section-title">Gastos de hoy</h2><button className="link-btn" onClick={onGasto}>+ Anotar gasto</button></div>
        {data.gastos.length ? (
          <div className="list">
            {data.gastos.map((g) => (
              <div key={g.id} className="list-item"><span className="grow"><span className="title">{g.descripcion}</span><br /><span className="subtle">{g.categoria} · {METODO_LABEL[g.metodo]}</span></span><b className="money">−{money(g.monto)}</b></div>
            ))}
          </div>
        ) : <p className="muted">Sin gastos hoy.</p>}
      </section>

      <Arqueo key={dia} dia={dia} fondoInicial={data.fondo} efectivo={por.efectivo || 0} gastosEf={gastosEf} entradas={entradas} salidas={salidas} por={por} cierre={data.cierre} />
    </div>
  )
}

function Gastos({ onGasto }) {
  const [per, setPer] = useState('mes')
  const [del, setDel] = useState(null)
  const toast = useToast()
  const { desde, hasta } = periodo(per)
  const gastos = useLiveQuery(() => db.gastos.where('fecha').between(desde, hasta, true, true).reverse().sortBy('fecha'), [desde, hasta])
  const total = (gastos || []).reduce((s, g) => s + g.monto, 0)
  const porCat = {}
  ;(gastos || []).forEach((g) => { porCat[g.categoria] = (porCat[g.categoria] || 0) + g.monto })
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1])
  return (
    <div className="stack">
      <div className="seg" role="group" aria-label="Período">
        {[['hoy', 'Hoy'], ['semana', '7 días'], ['mes', 'Este mes'], ['mesAnterior', 'Mes ant.']].map(([id, l]) => <button key={id} aria-pressed={per === id} onClick={() => setPer(id)}>{l}</button>)}
      </div>
      <button className="btn btn-soft" onClick={onGasto}><Plus /> Anotar gasto</button>
      {gastos && !gastos.length ? <Empty title="Sin gastos en este período" text="Anotá alquiler, mercadería, envíos o publicidad para ver tu ganancia real." /> : (
        <>
          <div className="panel panel-pad stack" style={{ gap: 10 }}>
            <div className="row-between"><b>Total gastado</b><b className="money" style={{ fontSize: 'var(--fs-md)' }}>{money(total)}</b></div>
            {cats.map(([c, v]) => (
              <div key={c} className="hbar"><span>{c}</span><b className="money">{money(v)}</b><div className="hbar-track"><span style={{ width: `${(v / total) * 100}%` }} /></div></div>
            ))}
          </div>
          <div className="list">
            {(gastos || []).map((g) => (
              <div key={g.id} className="list-item">
                <span className="grow"><span className="title">{g.descripcion}</span><br /><span className="subtle">{fechaRelativa(g.fecha)} · {g.categoria} · {METODO_LABEL[g.metodo]}</span></span>
                <b className="money">−{money(g.monto)}</b>
                <button className="icon-btn" onClick={() => setDel(g)} aria-label="Borrar gasto"><Trash2 /></button>
              </div>
            ))}
          </div>
        </>
      )}
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="¿Borrar este gasto?" confirmLabel="Borrar" text={del ? `${del.descripcion} · ${money(del.monto)}` : ''}
        onConfirm={async () => { await db.gastos.delete(del.id); toast('Gasto borrado') }} />
    </div>
  )
}

function Cierres() {
  const cierres = useLiveQuery(() => db.cierres.orderBy('fecha').reverse().limit(60).toArray(), [])
  if (cierres && !cierres.length) return <Empty title="Todavía no cerraste ninguna caja" text="Al final del día contá el efectivo y cerrá la caja para detectar faltantes." />
  return (
    <div className="list">
      {(cierres || []).map((c) => (
        <div key={c.id} className="list-item">
          <span className="grow"><span className="title">{fechaRelativa(c.fecha)}</span><br /><span className="subtle">Entró {money(c.entradas)}{c.salidas ? ` · devuelto ${money(c.salidas)}` : ''} · contado {money(c.contado)}{c.nota ? ` · ${c.nota}` : ''}</span></span>
          <span className={`badge ${c.diferencia === 0 ? 'badge-ok' : c.diferencia > 0 ? 'badge-warn' : 'badge-bad'}`}>{c.diferencia === 0 ? 'justa' : `${c.diferencia > 0 ? '+' : '−'}${money(Math.abs(c.diferencia))}`}</span>
        </div>
      ))}
    </div>
  )
}

export default function Caja() {
  const [sp, setSp] = useSearchParams()
  const [tab, setTab] = useState('hoy')
  const gasto = sp.get('gasto') === '1'
  const setGasto = (v) => setSp(v ? { gasto: '1' } : {}, { replace: true })
  return (
    <Page title="Caja y gastos" back="/mas">
      <div className="stack-lg" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="seg" role="tablist" aria-label="Secciones">
          {[['hoy', 'Caja de hoy'], ['gastos', 'Gastos'], ['cierres', 'Cierres']].map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>{l}</button>)}
        </div>
        {tab === 'hoy' && <CajaHoy onGasto={() => setGasto(true)} />}
        {tab === 'gastos' && <Gastos onGasto={() => setGasto(true)} />}
        {tab === 'cierres' && <Cierres />}
      </div>
      {gasto && <GastoForm open onClose={() => setGasto(false)} />}
    </Page>
  )
}
