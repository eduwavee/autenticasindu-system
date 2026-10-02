import Dexie from 'dexie'
import { fotoABlob, fotoADataUrl } from './fotos'

export const db = new Dexie('autenticas')

db.version(1).stores({
  productos: '++id, nombre, categoria, activo, creado',
  variantes: '++id, productoId, [productoId+talle+color]',
  clientas: '++id, nombre, telefono, creado',
  ventas: '++id, fecha, clientaId, estado, anulada',
  cobros: '++id, fecha, ventaId, clientaId, metodo, tipo',
  gastos: '++id, fecha, categoria, metodo',
  cierres: '++id, fecha',
  config: 'key',
})

db.version(2).stores({
  creditos: '++id, fecha, clientaId, ventaId',
  devoluciones: '++id, fecha, ventaId, clientaId',
  fondos: 'dia',
  ingresos: '++id, fecha',
}).upgrade(async (tx) => {
  const t = {}
  for (const n of ['config', 'ventas', 'productos']) t[n] = await tx.table(n).toArray()
  const m = migrarTablasV1(t)
  await tx.table('config').clear()
  await tx.table('config').bulkPut(m.config)
  await tx.table('ventas').bulkPut(m.ventas)
  await tx.table('productos').bulkPut(m.productos)
  if (m.fondos.length) await tx.table('fondos').bulkPut(m.fondos)
})

/** Versión del formato de backup que genera esta app. */
export const BACKUP_VERSION = 2

const suma = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0)

/**
 * Datos v1 → v2 (se usa en la migración de Dexie y al restaurar backups viejos).
 * - el fondo de caja deja la tabla config y pasa a `fondos`
 * - las ventas registran `cuenta` (lo cobrado después con pagos a cuenta) y dejan de copiar la foto
 * - las fotos pasan de dataURL a Blob
 */
export function migrarTablasV1(tablas) {
  const config = (tablas.config || []).filter((r) => !String(r.key).startsWith('fondo_'))
  const fondos = (tablas.config || [])
    .filter((r) => String(r.key).startsWith('fondo_'))
    .map((r) => ({ dia: String(r.key).slice(6), monto: Number(r.value) || 0 }))
  const ventas = (tablas.ventas || []).map((v) => ({
    ...v,
    items: (v.items || []).map(({ foto: _foto, ...i }) => i),
    cuenta: v.anulada ? 0 : Math.max(0, (v.total || 0) - suma(v.pagos || [], (p) => p.monto) - (v.saldo || 0)),
    devuelto: v.devuelto || 0,
  }))
  const productos = (tablas.productos || []).map((p) => ({ ...p, foto: fotoABlob(p.foto) }))
  return {
    ...tablas, config, fondos, ventas, productos,
    creditos: tablas.creditos || [], devoluciones: tablas.devoluciones || [], ingresos: tablas.ingresos || [],
  }
}

export const METODOS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia / MP' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
]
export const METODO_LABEL = Object.fromEntries(METODOS.map((m) => [m.id, m.label]))
METODO_LABEL.fiado = 'A cuenta'
METODO_LABEL.afavor = 'Saldo a favor'
METODO_LABEL.cambio = 'Cambio'

/** Medios que no son plata que entra: no generan cobro en la caja. */
export const METODOS_SIN_CAJA = ['afavor', 'cambio']

export const CANALES = [
  { id: 'local', label: 'Local' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp', label: 'WhatsApp' },
]

export const CATEGORIAS = ['Remeras y tops', 'Vestidos', 'Pantalones', 'Faldas', 'Abrigos', 'Accesorios']
export const CATEGORIAS_GASTO = ['Mercadería', 'Alquiler', 'Servicios', 'Envíos', 'Publicidad', 'Sueldos', 'Otros']
export const TALLES_SUGERIDOS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único', '36', '38', '40', '42', '44']

export const CONFIG_DEFAULT = {
  tienda: 'Auténticas',
  instagram: 'autenticas_ind_',
  whatsapp: '',
  alias: '',
  metaDiaria: 150000,
  descuentoEfectivo: 10,
  recargoCredito: 0,
  stockBajo: 2,
  diasQuieta: 60,
  ultimoBackup: null,
  onboarded: false,
  pinHash: null,
  discreto: false,
}

export async function getConfig() {
  const rows = await db.config.toArray()
  const cfg = { ...CONFIG_DEFAULT }
  rows.forEach((r) => { cfg[r.key] = r.value })
  return cfg
}

export async function setConfig(patch) {
  await db.config.bulkPut(Object.entries(patch).map(([key, value]) => ({ key, value })))
}

/* ---------- Saldo a favor ---------- */

export async function saldoAFavor(clientaId) {
  if (!clientaId) return 0
  return suma(await db.creditos.where('clientaId').equals(clientaId).toArray(), (c) => c.monto)
}

export async function creditosPorClienta() {
  const map = {}
  ;(await db.creditos.toArray()).forEach((c) => { if (c.clientaId) map[c.clientaId] = (map[c.clientaId] || 0) + c.monto })
  Object.keys(map).forEach((k) => { if (map[k] <= 0) delete map[k] })
  return map
}

/** Seña o adelanto: entra plata y queda como saldo a favor de la clienta. */
export async function cargarSaldoAFavor(clientaId, monto, metodo) {
  if (!clientaId || !(monto > 0)) throw new Error('Indicá la clienta y el monto.')
  return db.transaction('rw', db.cobros, db.creditos, async () => {
    const fecha = Date.now()
    await db.cobros.add({ fecha, monto, metodo, ventaId: null, clientaId, tipo: 'senia' })
    await db.creditos.add({ fecha, clientaId, monto, motivo: 'seña', ventaId: null })
  })
}

/** Le devolvés plata a la clienta de su saldo a favor. */
export async function devolverSaldoAFavor(clientaId, monto, metodo) {
  return db.transaction('rw', db.cobros, db.creditos, async () => {
    const disp = await saldoAFavor(clientaId)
    if (!(monto > 0) || monto > disp) throw new Error(`Solo tiene ${disp} de saldo a favor.`)
    const fecha = Date.now()
    await db.cobros.add({ fecha, monto: -monto, metodo, ventaId: null, clientaId, tipo: 'reintegro' })
    await db.creditos.add({ fecha, clientaId, monto: -monto, motivo: 'devuelto', ventaId: null })
  })
}

/* ---------- Ventas ---------- */

function chequearDestino(destino, clientaId) {
  if (destino?.tipo === 'afavor' && !clientaId) throw new Error('Para dejar saldo a favor, la venta tiene que tener una clienta.')
}

/** Cuánto se devuelve si se devuelven esas líneas. Puro: lo usa la UI para mostrar el resultado antes. */
export function calcDevolucion(v, lineas) {
  const items = []
  let bruto = 0
  let costo = 0
  for (const { idx, cantidad } of lineas) {
    const it = v.items[idx]
    if (!it) continue
    const c = Math.min(Number(cantidad) || 0, it.cantidad - (it.devuelto || 0))
    if (c <= 0) continue
    items.push({ ...it, idx, cantidad: c })
    bruto += it.precio * c
    costo += (it.costo || 0) * c
  }
  const quedan = v.items.reduce((s, it, i) => s + it.cantidad - (it.devuelto || 0) - suma(items.filter((x) => x.idx === i), (x) => x.cantidad), 0)
  const subtotal = v.subtotal || suma(v.items, (i) => i.precio * i.cantidad)
  // La última devolución se lleva el resto exacto para que no queden centavos por redondeo.
  const valor = !items.length ? 0 : quedan === 0 ? v.total - (v.devuelto || 0) : Math.round(subtotal ? (bruto * v.total) / subtotal : bruto)
  const aSaldo = Math.min(v.saldo || 0, valor)
  return { items, valor, costo, aSaldo, resto: valor - aSaldo, completa: quedan === 0 }
}

/** Aplica la devolución dentro de una transacción abierta. El resto (lo que ya había pagado) lo decide quien llama. */
async function aplicarDevolucion(v, lineas, fecha, extra = {}) {
  const dev = calcDevolucion(v, lineas)
  if (!dev.items.length) throw new Error('Elegí qué prendas vuelven.')
  for (const it of dev.items) {
    if (!it.varianteId) continue
    const varr = await db.variantes.get(it.varianteId)
    if (varr) await db.variantes.update(it.varianteId, { stock: varr.stock + it.cantidad })
  }
  const items = v.items.map((it, i) => {
    const d = suma(dev.items.filter((x) => x.idx === i), (x) => x.cantidad)
    return d ? { ...it, devuelto: (it.devuelto || 0) + d } : it
  })
  const saldo = (v.saldo || 0) - dev.aSaldo
  const patch = { items, saldo, devuelto: (v.devuelto || 0) + dev.valor, estado: v.anulada ? 'anulada' : saldo > 0 ? 'debe' : 'pagada' }
  await db.ventas.update(v.id, patch)
  Object.assign(v, patch)
  const devolucionId = await db.devoluciones.add({
    fecha, ventaId: v.id, clientaId: v.clientaId || null,
    items: dev.items.map(({ idx, nombre, talle, color, precio, costo, categoria, cantidad, productoId, varianteId }) => ({ idx, nombre, talle, color, precio, costo, categoria, cantidad, productoId, varianteId })),
    valor: dev.valor, costo: dev.costo, aSaldo: dev.aSaldo, resto: dev.resto, ...extra,
  })
  return { ...dev, devolucionId }
}

/** Qué se hace con plata ya pagada que vuelve: reintegro (sale de la caja hoy) o saldo a favor. */
async function destinarResto(monto, destino, { fecha, ventaId, clientaId, devolucionId }) {
  if (!(monto > 0)) return
  if (destino?.tipo === 'afavor') {
    await db.creditos.add({ fecha, clientaId, monto, motivo: 'devolución', ventaId })
  } else {
    await db.cobros.add({ fecha, monto: -monto, metodo: destino?.metodo || 'efectivo', ventaId, clientaId: clientaId || null, tipo: 'reintegro', devolucionId })
  }
  if (devolucionId) await db.devoluciones.update(devolucionId, { destino: destino?.tipo === 'afavor' ? 'afavor' : destino?.metodo || 'efectivo', destinoMonto: monto })
}

const TX_VENTA = ['ventas', 'variantes', 'cobros', 'creditos', 'devoluciones']

/**
 * venta = { items:[{productoId,varianteId,nombre,talle,color,precio,costo,categoria,cantidad}],
 *   subtotal, descuento, recargo, total, pagos:[{metodo,monto}], clientaId, canal, nota, entregada }
 * opts.cambio = { ventaId, lineas:[{idx,cantidad}], excedente: {tipo:'afavor'} | {tipo:'reintegro', metodo} }
 *   → en la misma operación vuelven las prendas de la venta original y su valor paga esta venta (medio 'cambio').
 */
export async function registrarVenta(v, opts = {}) {
  return db.transaction('rw', TX_VENTA.map((t) => db.table(t)), async () => {
    const fecha = Date.now()
    const pagos = (v.pagos || []).filter((p) => p.monto > 0)
    const clientaId = v.clientaId || null

    let cambio = null
    if (opts.cambio) {
      const orig = await db.ventas.get(opts.cambio.ventaId)
      if (!orig || orig.anulada) throw new Error('La venta original del cambio ya no está disponible.')
      cambio = await aplicarDevolucion(orig, opts.cambio.lineas, fecha, { tipo: 'cambio' })
      const usado = suma(pagos.filter((p) => p.metodo === 'cambio'), (p) => p.monto)
      if (usado > cambio.resto) throw new Error('El crédito del cambio es menor a lo que se quiere usar.')
      const excedente = cambio.resto - usado
      chequearDestino(excedente > 0 ? opts.cambio.excedente : null, clientaId || orig.clientaId)
      await destinarResto(excedente, opts.cambio.excedente, { fecha, ventaId: orig.id, clientaId: clientaId || orig.clientaId, devolucionId: cambio.devolucionId })
    } else if (pagos.some((p) => p.metodo === 'cambio')) {
      throw new Error('Falta la venta original del cambio.')
    }

    const afavor = suma(pagos.filter((p) => p.metodo === 'afavor'), (p) => p.monto)
    if (afavor > 0) {
      if (!clientaId) throw new Error('Para usar saldo a favor, elegí la clienta.')
      const disp = await saldoAFavor(clientaId)
      if (afavor > disp) throw new Error('La clienta no tiene tanto saldo a favor.')
    }

    // Stock: se valida todo antes de descontar nada.
    const pedido = {}
    for (const it of v.items) if (it.varianteId) pedido[it.varianteId] = (pedido[it.varianteId] || 0) + it.cantidad
    const vars = {}
    for (const [vid, cant] of Object.entries(pedido)) {
      const varr = await db.variantes.get(Number(vid))
      const it = v.items.find((i) => i.varianteId === Number(vid))
      const nombre = `${it.nombre} (talle ${it.talle}${it.color ? ' · ' + it.color : ''})`
      if (!varr) throw new Error(`${nombre} ya no está cargada en el stock.`)
      if (varr.stock < cant) throw new Error(`No alcanza el stock de ${nombre}: ${varr.stock === 0 ? 'no queda ninguna' : `quedan ${varr.stock}`}.`)
      vars[vid] = varr
    }

    const pagado = suma(pagos, (p) => p.monto)
    if (pagado > v.total) throw new Error('Los pagos superan el total de la venta.')
    const saldo = v.total - pagado
    if (saldo > 0 && !clientaId) throw new Error('Para dejar saldo a cuenta, elegí la clienta.')

    const items = v.items.map(({ foto: _f, max: _m, ...i }) => ({ ...i, devuelto: 0 }))
    const ventaId = await db.ventas.add({
      ...v, items, pagos, clientaId, fecha, saldo, cuenta: 0, devuelto: 0,
      estado: saldo > 0 ? 'debe' : 'pagada', anulada: 0,
      ...(cambio ? { cambioDe: opts.cambio.ventaId } : {}),
    })
    for (const [vid, cant] of Object.entries(pedido)) await db.variantes.update(Number(vid), { stock: vars[vid].stock - cant })
    for (const p of pagos) {
      if (!METODOS_SIN_CAJA.includes(p.metodo)) await db.cobros.add({ fecha, monto: p.monto, metodo: p.metodo, ventaId, clientaId, tipo: 'venta' })
    }
    if (afavor > 0) await db.creditos.add({ fecha, clientaId, monto: -afavor, motivo: 'uso', ventaId })
    if (cambio) await db.devoluciones.update(cambio.devolucionId, { cambioVentaId: ventaId })
    return ventaId
  })
}

/** Devolución parcial: vuelven al stock las prendas elegidas. Primero baja lo que debía; lo ya pagado va según `destino`. */
export async function devolverItems(ventaId, lineas, destino) {
  return db.transaction('rw', TX_VENTA.map((t) => db.table(t)), async () => {
    const v = await db.ventas.get(ventaId)
    if (!v || v.anulada) throw new Error('Esta venta ya no admite devoluciones.')
    const fecha = Date.now()
    const dev = calcDevolucion(v, lineas)
    if (dev.resto > 0) chequearDestino(destino, v.clientaId)
    const r = await aplicarDevolucion(v, lineas, fecha, { tipo: 'devolucion' })
    await destinarResto(r.resto, destino, { fecha, ventaId, clientaId: v.clientaId, devolucionId: r.devolucionId })
    if (r.completa) await db.ventas.update(ventaId, { estado: 'devuelta' })
    return r
  })
}

/**
 * Anular = devolver todo lo que queda. Los cobros originales NO se tocan (los días pasados y sus cierres
 * quedan como estaban): lo pagado vuelve hoy como reintegro o queda como saldo a favor.
 */
export async function anularVenta(id, destino = { tipo: 'reintegro', metodo: 'efectivo' }) {
  return db.transaction('rw', TX_VENTA.map((t) => db.table(t)), async () => {
    const v = await db.ventas.get(id)
    if (!v || v.anulada) return null
    const fecha = Date.now()
    const lineas = v.items.map((it, idx) => ({ idx, cantidad: it.cantidad - (it.devuelto || 0) })).filter((l) => l.cantidad > 0)
    let r = null
    if (lineas.length) {
      const dev = calcDevolucion(v, lineas)
      if (dev.resto > 0) chequearDestino(destino, v.clientaId)
      r = await aplicarDevolucion(v, lineas, fecha, { tipo: 'anulacion' })
      await destinarResto(r.resto, destino, { fecha, ventaId: id, clientaId: v.clientaId, devolucionId: r.devolucionId })
    }
    await db.ventas.update(id, { anulada: 1, porDevolucion: true, estado: 'anulada', saldo: 0, anuladaEl: fecha })
    return r
  })
}

/** Imputa `monto` a las ventas con saldo de la clienta, las más viejas primero. Devuelve lo que sobró. */
async function imputarADeudas(clientaId, monto) {
  let resto = monto
  const pendientes = (await db.ventas.where('clientaId').equals(clientaId).sortBy('fecha')).filter((v) => !v.anulada && v.saldo > 0)
  for (const v of pendientes) {
    if (resto <= 0) break
    const aplica = Math.min(resto, v.saldo)
    const saldo = v.saldo - aplica
    resto -= aplica
    await db.ventas.update(v.id, { saldo, cuenta: (v.cuenta || 0) + aplica, estado: saldo > 0 ? 'debe' : 'pagada' })
  }
  return resto
}

/** Pago de una clienta a cuenta. Lo que exceda la deuda queda como saldo a favor. */
export async function cobrarDeuda(clientaId, monto, metodo) {
  return db.transaction('rw', db.ventas, db.cobros, db.creditos, async () => {
    const fecha = Date.now()
    await db.cobros.add({ fecha, monto, metodo, ventaId: null, clientaId, tipo: 'pago_cuenta' })
    const sobra = await imputarADeudas(clientaId, monto)
    if (sobra > 0) await db.creditos.add({ fecha, clientaId, monto: sobra, motivo: 'pago de más', ventaId: null })
    return { aplicado: monto - sobra, aFavor: sobra }
  })
}

/** Usa el saldo a favor para cancelar deuda (no entra plata a la caja). */
export async function compensarDeudaConSaldo(clientaId) {
  return db.transaction('rw', db.ventas, db.creditos, async () => {
    const disp = await saldoAFavor(clientaId)
    if (disp <= 0) return 0
    const sobra = await imputarADeudas(clientaId, disp)
    const usado = disp - sobra
    if (usado > 0) await db.creditos.add({ fecha: Date.now(), clientaId, monto: -usado, motivo: 'compensa deuda', ventaId: null })
    return usado
  })
}

export async function deudaPorClienta() {
  const ventas = await db.ventas.where('estado').equals('debe').toArray()
  const map = {}
  ventas.forEach((v) => {
    if (!v.clientaId || v.anulada) return
    map[v.clientaId] = (map[v.clientaId] || 0) + v.saldo
  })
  return map
}

/**
 * Corrige datos de una venta sin tocar prendas ni montos: clienta, canal, nota, entrega y el medio de cada pago.
 * patch.metodos: { [indiceDePago]: nuevoMetodo }
 */
export async function editarVenta(id, patch) {
  return db.transaction('rw', db.ventas, db.cobros, async () => {
    const v = await db.ventas.get(id)
    if (!v || v.anulada) throw new Error('Esta venta ya no se puede editar.')
    const upd = {}
    for (const k of ['canal', 'nota', 'entregada']) if (k in patch) upd[k] = patch[k]
    if ('clientaId' in patch && (patch.clientaId || null) !== (v.clientaId || null)) {
      const nueva = patch.clientaId || null
      if (!nueva && v.saldo > 0) throw new Error('Esta venta tiene saldo pendiente: tiene que quedar a nombre de alguien.')
      if (v.pagos.some((p) => p.metodo === 'afavor')) throw new Error('Se pagó con saldo a favor de la clienta: no se puede cambiar de clienta.')
      if ((v.cuenta || 0) > 0) throw new Error('Ya tiene pagos a cuenta de esta clienta: no se puede cambiar de clienta.')
      upd.clientaId = nueva
      await db.cobros.where('ventaId').equals(id).modify({ clientaId: nueva })
    }
    if (patch.metodos && Object.keys(patch.metodos).length) {
      const cobros = (await db.cobros.where('ventaId').equals(id).toArray()).filter((c) => c.tipo === 'venta')
      const usados = new Set()
      const pagos = v.pagos.map((p, i) => {
        const nuevo = patch.metodos[i]
        if (!nuevo || nuevo === p.metodo || METODOS_SIN_CAJA.includes(p.metodo) || METODOS_SIN_CAJA.includes(nuevo)) return p
        const c = cobros.find((x) => !usados.has(x.id) && x.metodo === p.metodo && x.monto === p.monto)
        if (c) { usados.add(c.id); c.metodo = nuevo }
        return { ...p, metodo: nuevo }
      })
      for (const c of cobros) if (usados.has(c.id)) await db.cobros.update(c.id, { metodo: c.metodo })
      upd.pagos = pagos
    }
    await db.ventas.update(id, upd)
  })
}

/* ---------- Mercadería y precios ---------- */

/**
 * Entrada de mercadería: suma stock, actualiza el costo y (opcional) anota el gasto.
 * items: [{ productoId, varianteId, cantidad, costo }]
 */
export async function registrarIngreso({ proveedor = '', items, gastoMetodo = null }) {
  const lineas = items.filter((i) => i.cantidad > 0)
  if (!lineas.length) throw new Error('Cargá al menos una prenda con cantidad.')
  return db.transaction('rw', db.productos, db.variantes, db.gastos, db.ingresos, async () => {
    const fecha = Date.now()
    const detalle = []
    for (const it of lineas) {
      const [varr, prod] = await Promise.all([db.variantes.get(it.varianteId), db.productos.get(it.productoId)])
      if (!varr || !prod) throw new Error('Una de las prendas ya no existe.')
      await db.variantes.update(varr.id, { stock: varr.stock + it.cantidad })
      const costo = Number(it.costo) || prod.costo || 0
      if (Number(it.costo) > 0 && Number(it.costo) !== prod.costo) await db.productos.update(prod.id, { costo: Number(it.costo) })
      detalle.push({ productoId: prod.id, varianteId: varr.id, nombre: prod.nombre, talle: varr.talle, color: varr.color, cantidad: it.cantidad, costo })
    }
    const total = suma(detalle, (d) => d.costo * d.cantidad)
    let gastoId = null
    if (gastoMetodo && total > 0) {
      gastoId = await db.gastos.add({ fecha, categoria: 'Mercadería', descripcion: proveedor.trim() ? `Mercadería · ${proveedor.trim()}` : 'Ingreso de mercadería', monto: total, metodo: gastoMetodo })
    }
    return db.ingresos.add({ fecha, proveedor: proveedor.trim(), items: detalle, total, gastoId })
  })
}

export function nuevoPrecio(precio, pct, redondeo = 0) {
  const p = precio * (1 + pct / 100)
  return Math.max(0, redondeo > 0 ? Math.round(p / redondeo) * redondeo : Math.round(p))
}

/** Sube (o baja) precios en bloque. ids: productos a tocar. */
export async function actualizarPrecios(ids, pct, redondeo = 0) {
  return db.transaction('rw', db.productos, async () => {
    let n = 0
    const cuando = Date.now()
    for (const id of ids) {
      const p = await db.productos.get(id)
      if (!p) continue
      const precio = nuevoPrecio(p.precio, pct, redondeo)
      if (precio !== p.precio) { await db.productos.update(id, { precio, precioAnterior: p.precio, precioCambiado: cuando }); n++ }
    }
    return n
  })
}

/** Vuelve atrás la última actualización en bloque. */
export async function deshacerPrecios() {
  return db.transaction('rw', db.productos, async () => {
    const todos = await db.productos.toArray()
    const ultima = Math.max(0, ...todos.map((p) => p.precioCambiado || 0))
    if (!ultima) return 0
    const tocados = todos.filter((p) => p.precioCambiado === ultima && p.precioAnterior)
    for (const p of tocados) await db.productos.update(p.id, { precio: p.precioAnterior, precioAnterior: null, precioCambiado: null })
    return tocados.length
  })
}

/* ---------- Caja ---------- */

export async function getFondo(dia) { return (await db.fondos.get(dia))?.monto ?? '' }
export async function setFondo(dia, monto) { await db.fondos.put({ dia, monto: Number(monto) || 0 }) }

/* ---------- Backup ---------- */

export const TABLAS = ['productos', 'variantes', 'clientas', 'ventas', 'cobros', 'gastos', 'cierres', 'config', 'creditos', 'devoluciones', 'fondos', 'ingresos']

export async function exportarBackup() {
  const data = { app: 'autenticas', version: BACKUP_VERSION, exportado: new Date().toISOString(), tablas: {} }
  for (const t of TABLAS) data.tablas[t] = await db.table(t).toArray()
  data.tablas.productos = await Promise.all(data.tablas.productos.map(async (p) => ({ ...p, foto: await fotoADataUrl(p.foto) })))
  return data
}

export function validarBackup(data) {
  if (!data || data.app !== 'autenticas' || typeof data.tablas !== 'object' || !data.tablas) throw new Error('El archivo no es un backup de Auténticas.')
  const version = Number(data.version) || 1
  if (version > BACKUP_VERSION) throw new Error('Este backup es de una versión más nueva de la app. Actualizá la app (recargá la página) y probá de nuevo.')
  for (const [t, rows] of Object.entries(data.tablas)) if (rows != null && !Array.isArray(rows)) throw new Error(`El backup está dañado (tabla ${t}).`)
  if (!Array.isArray(data.tablas.productos) || !Array.isArray(data.tablas.ventas)) throw new Error('El backup está incompleto.')
  return version
}

export async function importarBackup(data) {
  const version = validarBackup(data)
  const tablas = version < 2 ? migrarTablasV1(data.tablas) : { ...data.tablas }
  tablas.productos = (tablas.productos || []).map((p) => ({ ...p, foto: fotoABlob(p.foto) }))
  await db.transaction('rw', TABLAS.map((t) => db.table(t)), async () => {
    for (const t of TABLAS) {
      await db.table(t).clear()
      if (tablas[t]?.length) await db.table(t).bulkAdd(tablas[t])
    }
  })
}

export async function borrarTodo() {
  await db.transaction('rw', TABLAS.map((t) => db.table(t)), async () => {
    for (const t of TABLAS) await db.table(t).clear()
  })
}

/* ---------- PIN ---------- */

export async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`autenticas:${pin}`))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
