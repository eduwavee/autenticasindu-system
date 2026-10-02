import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, Plus, Trash2, EyeOff, Eye, X, QrCode } from 'lucide-react'
import { db, CATEGORIAS, TALLES_SUGERIDOS } from '../db'
import { useFotoUrl } from '../hooks'
import { Page } from '../layout'
import { Confirm, MoneyInput, useToast, GarmentArt } from '../ui'
import { comprimirImagen, money, colorHex } from '../utils'

const key = (c, t) => `${c}|${t}`

export default function ProductoForm() {
  const { id } = useParams()
  const editando = !!id
  const nav = useNavigate()
  const toast = useToast()
  const [p, setP] = useState({ nombre: '', categoria: CATEGORIAS[0], precio: '', costo: '', descripcion: '', foto: null, activo: 1 })
  const [talles, setTalles] = useState(['S', 'M', 'L'])
  const [colores, setColores] = useState([''])
  const [stock, setStock] = useState({})
  const [nuevoTalle, setNuevoTalle] = useState('')
  const [nuevoColor, setNuevoColor] = useState('')
  const [errores, setErrores] = useState({})
  const [confirmDel, setConfirmDel] = useState(false)
  const [loaded, setLoaded] = useState(!editando)

  useEffect(() => {
    if (!editando) return
    ;(async () => {
      const prod = await db.productos.get(Number(id))
      if (!prod) { nav('/stock', { replace: true }); return }
      const vs = await db.variantes.where('productoId').equals(prod.id).toArray()
      setP(prod)
      const ts = [...new Set(vs.map((v) => v.talle))]
      const cs = [...new Set(vs.map((v) => v.color || ''))]
      setTalles(ts.length ? ts : ['Único'])
      setColores(cs.length ? cs : [''])
      setStock(Object.fromEntries(vs.map((v) => [key(v.color || '', v.talle), v.stock])))
      setLoaded(true)
    })()
  }, [id, editando, nav])

  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))

  const onFoto = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try { set('foto')(await comprimirImagen(f)) } catch (err) { toast(err.message, 'error') }
  }

  const toggleTalle = (t) => setTalles((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
  const agregarTalle = () => { const t = nuevoTalle.trim().toUpperCase(); if (t && !talles.includes(t)) setTalles([...talles, t]); setNuevoTalle('') }
  const agregarColor = () => {
    const c = nuevoColor.trim()
    if (!c) return
    const cap = c.charAt(0).toUpperCase() + c.slice(1)
    setColores((cs) => (cs.includes(cap) ? cs : [...cs.filter((x) => x !== ''), cap]))
    setNuevoColor('')
  }
  const quitarColor = (c) => setColores((cs) => { const n = cs.filter((x) => x !== c); return n.length ? n : [''] })

  const guardar = async () => {
    const e = {}
    if (!p.nombre.trim()) e.nombre = 'Poné un nombre para la prenda.'
    if (!(Number(p.precio) > 0)) e.precio = 'Indicá el precio de venta.'
    if (!talles.length) e.talles = 'Elegí al menos un talle.'
    setErrores(e)
    if (Object.keys(e).length) return

    const data = { nombre: p.nombre.trim(), categoria: p.categoria, precio: Number(p.precio), costo: Number(p.costo) || 0, descripcion: p.descripcion || '', foto: p.foto || null, activo: p.activo ?? 1 }
    await db.transaction('rw', db.productos, db.variantes, async () => {
      let pid = Number(id)
      if (editando) await db.productos.update(pid, data)
      else pid = await db.productos.add({ ...data, creado: Date.now() })
      const existentes = await db.variantes.where('productoId').equals(pid).toArray()
      const vivas = new Set()
      for (const c of colores) {
        for (const t of talles) {
          const k = key(c, t)
          vivas.add(k)
          const ex = existentes.find((v) => key(v.color || '', v.talle) === k)
          const s = Math.max(0, Number(stock[k]) || 0)
          if (ex) await db.variantes.update(ex.id, { stock: s })
          else await db.variantes.add({ productoId: pid, talle: t, color: c, stock: s })
        }
      }
      const borrar = existentes.filter((v) => !vivas.has(key(v.color || '', v.talle))).map((v) => v.id)
      if (borrar.length) await db.variantes.bulkDelete(borrar)
    })
    toast(editando ? 'Prenda actualizada' : 'Prenda cargada')
    nav('/stock')
  }

  const eliminar = async () => {
    await db.transaction('rw', db.productos, db.variantes, async () => {
      await db.variantes.where('productoId').equals(Number(id)).delete()
      await db.productos.delete(Number(id))
    })
    toast('Prenda eliminada')
    nav('/stock', { replace: true })
  }

  const fotoUrl = useFotoUrl(p.foto)
  if (!loaded) return <Page title="Prenda" back="/stock" />
  const margen = Number(p.precio) > 0 && Number(p.costo) > 0 ? Math.round(((p.precio - p.costo) / p.precio) * 100) : null
  const todosTalles = [...new Set([...TALLES_SUGERIDOS, ...talles])]

  return (
    <Page title={editando ? 'Editar prenda' : 'Nueva prenda'} back="/stock">
      <div className="stack-lg" style={{ maxWidth: 640, margin: '0 auto' }}>
        <section className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <label className="photo-pick">
            {fotoUrl ? <img src={fotoUrl} alt="Foto de la prenda" /> : <span><Camera size={22} />Agregar foto</span>}
            <input type="file" accept="image/*" onChange={onFoto} aria-label="Foto de la prenda" />
          </label>
          <div className="grow stack">
            <label className="field">
              <span>Nombre</span>
              <input className="input" value={p.nombre} onChange={set('nombre')} placeholder="Ej: Vestido midi de lino" aria-invalid={!!errores.nombre} />
              {errores.nombre && <span className="field-error">{errores.nombre}</span>}
            </label>
            <label className="field">
              <span>Categoría</span>
              <select className="select" value={p.categoria} onChange={set('categoria')}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            {p.foto && <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => set('foto')(null)}>Quitar foto</button>}
            {!p.foto && <div className="row subtle" style={{ gap: 6 }}><span style={{ width: 22, color: 'var(--rose-300)' }}><GarmentArt categoria={p.categoria} /></span>Sin foto se muestra este dibujo.</div>}
          </div>
        </section>

        <section className="grid-2">
          <label className="field">
            <span>Precio de venta</span>
            <MoneyInput value={p.precio} onChange={set('precio')} aria-invalid={!!errores.precio} />
            {errores.precio && <span className="field-error">{errores.precio}</span>}
          </label>
          <label className="field">
            <span>Costo (lo que te sale)</span>
            <MoneyInput value={p.costo} onChange={set('costo')} />
            {margen !== null && <span className="subtle">Ganás {money(p.precio - p.costo)} · margen {margen}%</span>}
          </label>
        </section>

        <section className="stack">
          <h2 className="section-title">Talles</h2>
          <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }} role="group" aria-label="Talles">
            {todosTalles.map((t) => <button key={t} className="chip" aria-pressed={talles.includes(t)} onClick={() => toggleTalle(t)}>{t}</button>)}
          </div>
          <div className="row">
            <input className="input" placeholder="Otro talle (ej: 46, 2XL)" value={nuevoTalle} onChange={(e) => setNuevoTalle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregarTalle()} />
            <button className="btn btn-soft" onClick={agregarTalle} disabled={!nuevoTalle.trim()}><Plus /> Sumar</button>
          </div>
          {errores.talles && <span className="field-error">{errores.talles}</span>}
        </section>

        <section className="stack">
          <h2 className="section-title">Colores</h2>
          <div className="row wrap" style={{ gap: 8 }}>
            {colores.filter(Boolean).map((c) => (
              <span key={c} className="chip" style={{ paddingRight: 4 }}>
                <span className="color-dot" style={{ background: colorHex(c) }} />{c}
                <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => quitarColor(c)} aria-label={`Quitar ${c}`}><X size={14} /></button>
              </span>
            ))}
            {!colores.filter(Boolean).length && <span className="subtle">Un solo color (sin especificar).</span>}
          </div>
          <div className="row">
            <input className="input" placeholder="Agregar color (ej: Negro)" value={nuevoColor} onChange={(e) => setNuevoColor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregarColor()} />
            <button className="btn btn-soft" onClick={agregarColor} disabled={!nuevoColor.trim()}><Plus /> Sumar</button>
          </div>
        </section>

        {talles.length > 0 && (
          <section className="stack">
            <h2 className="section-title">Stock por talle</h2>
            {colores.map((c) => (
              <div key={c || 'u'} className="panel panel-pad stack" style={{ gap: 10 }}>
                {c && <div className="row" style={{ gap: 8 }}><span className="color-dot" style={{ background: colorHex(c) }} /><b>{c}</b></div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 10 }}>
                  {talles.map((t) => (
                    <label key={t} className="field" style={{ gap: 4 }}>
                      <span style={{ textAlign: 'center' }}>{t}</span>
                      <input className="input num" style={{ textAlign: 'center' }} inputMode="numeric" value={stock[key(c, t)] ?? ''} placeholder="0"
                        onChange={(e) => setStock({ ...stock, [key(c, t)]: e.target.value.replace(/\D/g, '') })} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <label className="field"><span>Descripción para el catálogo (opcional)</span><textarea className="textarea" value={p.descripcion} onChange={set('descripcion')} placeholder="Tela, calce, cuidados…" /></label>

        <div className="stack">
          <button className="btn btn-primary btn-lg btn-block" onClick={guardar}>{editando ? 'Guardar cambios' : 'Cargar prenda'}</button>
          {editando && (
            <div className="grid-2">
              <button className="btn btn-ghost" onClick={() => setP({ ...p, activo: p.activo === 0 ? 1 : 0 })}>
                {p.activo === 0 ? <><Eye /> Mostrar</> : <><EyeOff /> Ocultar</>}
              </button>
              <button className="btn btn-danger" onClick={() => setConfirmDel(true)}><Trash2 /> Eliminar</button>
            </div>
          )}
          {editando && <Link className="btn btn-ghost" to={`/stock/etiquetas?p=${id}`}><QrCode /> Imprimir etiquetas</Link>}
          {editando && p.activo === 0 && <p className="subtle">Oculta: no aparece al vender ni en el catálogo. Guardá para aplicar.</p>}
        </div>
      </div>
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} danger title="¿Eliminar la prenda?" confirmLabel="Eliminar"
        text="Se borra la prenda y su stock. Las ventas anteriores quedan registradas. Si solo querés que no aparezca, usá Ocultar." onConfirm={eliminar} />
    </Page>
  )
}
