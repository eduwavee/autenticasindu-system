import { db, setConfig } from './db'

const PRODUCTOS = [
  { nombre: 'Remera oversize básica', categoria: 'Remeras y tops', precio: 18900, costo: 8500, talles: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Rosa'] },
  { nombre: 'Top lencero de satén', categoria: 'Remeras y tops', precio: 21500, costo: 9800, talles: ['S', 'M', 'L'], colores: ['Nude', 'Negro'] },
  { nombre: 'Body de morley manga larga', categoria: 'Remeras y tops', precio: 16900, costo: 7200, talles: ['Único'], colores: ['Negro', 'Blanco', 'Bordo'] },
  { nombre: 'Vestido midi de lino', categoria: 'Vestidos', precio: 42900, costo: 21000, talles: ['S', 'M', 'L'], colores: ['Crudo', 'Rosa viejo'] },
  { nombre: 'Vestido corto con volados', categoria: 'Vestidos', precio: 36500, costo: 17500, talles: ['XS', 'S', 'M'], colores: ['Fucsia', 'Negro'] },
  { nombre: 'Jean mom tiro alto', categoria: 'Pantalones', precio: 39900, costo: 19500, talles: ['36', '38', '40', '42', '44'], colores: ['Jean'] },
  { nombre: 'Palazzo de crepe', categoria: 'Pantalones', precio: 32900, costo: 15000, talles: ['S', 'M', 'L', 'XL'], colores: ['Negro', 'Camel'] },
  { nombre: 'Pollera plisada', categoria: 'Faldas', precio: 27900, costo: 12500, talles: ['S', 'M', 'L'], colores: ['Rosa', 'Gris'] },
  { nombre: 'Minifalda de cuero eco', categoria: 'Faldas', precio: 29500, costo: 13800, talles: ['S', 'M'], colores: ['Negro'] },
  { nombre: 'Blazer sastrero', categoria: 'Abrigos', precio: 58900, costo: 29000, talles: ['S', 'M', 'L'], colores: ['Negro', 'Beige'] },
  { nombre: 'Campera de jean cropped', categoria: 'Abrigos', precio: 49900, costo: 24500, talles: ['S', 'M', 'L'], colores: ['Jean'] },
  { nombre: 'Cartera baguette', categoria: 'Accesorios', precio: 24900, costo: 11000, talles: ['Único'], colores: ['Negro', 'Rosa', 'Blanco'] },
]

const CLIENTAS = [
  ['Lucía Paz', '3815550101', 'lu.paz'],
  ['Camila Ibáñez', '3815550102', 'cami.ibz'],
  ['Florencia Ruiz', '3815550103', ''],
  ['Agustina Herrera', '3815550104', 'agus.herrera'],
  ['Micaela Díaz', '3815550105', ''],
  ['Sofía Ledesma', '3815550106', 'sofi.led'],
  ['Valentina Correa', '3815550107', ''],
]

function rnd(seed) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

/** Carga datos de ejemplo (ilustrativos) para probar la app. */
export async function cargarDemo() {
  const r = rnd(42)
  const pick = (arr) => arr[Math.floor(r() * arr.length)]
  const ahora = Date.now()

  await db.transaction('rw', [db.productos, db.variantes, db.clientas, db.ventas, db.cobros, db.gastos], async () => {
    const variantesPorProd = []
    for (const [i, p] of PRODUCTOS.entries()) {
      const id = await db.productos.add({ nombre: p.nombre, categoria: p.categoria, precio: p.precio, costo: p.costo, descripcion: '', foto: null, activo: 1, creado: ahora - (40 - i) * 86400000 })
      const vs = []
      for (const c of p.colores) {
        for (const t of p.talles) {
          const stock = Math.floor(r() * 6)
          const vid = await db.variantes.add({ productoId: id, talle: t, color: c, stock })
          vs.push({ id: vid, talle: t, color: c, producto: { id, ...p } })
        }
      }
      variantesPorProd.push(vs)
    }

    const clientaIds = []
    for (const [nombre, telefono, instagram] of CLIENTAS) {
      clientaIds.push(await db.clientas.add({ nombre, telefono, instagram, notas: '', creado: ahora - 30 * 86400000 }))
    }

    const metodos = ['efectivo', 'efectivo', 'transferencia', 'transferencia', 'transferencia', 'debito', 'credito']
    const canales = ['local', 'local', 'instagram', 'whatsapp']
    for (let d = 29; d >= 0; d--) {
      const n = d === 0 ? 5 : 2 + Math.floor(r() * 5)
      for (let k = 0; k < n; k++) {
        const base = new Date(); base.setDate(base.getDate() - d); base.setHours(10 + Math.floor(r() * 10), Math.floor(r() * 60), 0, 0)
        const fecha = d === 0 ? Math.min(base.getTime(), ahora - (n - k) * 600000) : base.getTime()
        const lines = 1 + Math.floor(r() * 2)
        const items = []
        for (let l = 0; l < lines; l++) {
          const v = pick(pick(variantesPorProd))
          items.push({ productoId: v.producto.id, varianteId: v.id, nombre: v.producto.nombre, talle: v.talle, color: v.color, precio: v.producto.precio, costo: v.producto.costo, categoria: v.producto.categoria, cantidad: 1 })
        }
        const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
        const conClienta = r() < 0.45
        const clientaId = conClienta ? pick(clientaIds) : null
        const fiado = conClienta && r() < 0.18
        const metodo = pick(metodos)
        const pagado = fiado ? Math.round(total * 0.4 / 100) * 100 : total
        const pagos = [{ metodo, monto: pagado }]
        const saldo = total - pagado
        const ventaId = await db.ventas.add({
          fecha, items, subtotal: total, descuento: 0, recargo: 0, total, pagos, clientaId, canal: pick(canales), nota: '', entregada: true,
          saldo, estado: saldo > 0 ? 'debe' : 'pagada', anulada: 0,
        })
        await db.cobros.add({ fecha, monto: pagado, metodo, ventaId, clientaId, tipo: 'venta' })
      }
    }

    const gastos = [
      [27, 'Alquiler', 'Alquiler del local', 380000, 'transferencia'],
      [25, 'Mercadería', 'Compra a proveedor (Flores)', 520000, 'transferencia'],
      [20, 'Servicios', 'Luz', 46000, 'transferencia'],
      [14, 'Publicidad', 'Promoción en Instagram', 30000, 'credito'],
      [9, 'Envíos', 'Cadetería semanal', 18000, 'efectivo'],
      [6, 'Mercadería', 'Bolsas y papel de seda', 22500, 'efectivo'],
      [2, 'Envíos', 'Cadetería semanal', 18000, 'efectivo'],
      [0, 'Otros', 'Artículos de limpieza', 6400, 'efectivo'],
    ]
    for (const [d, categoria, descripcion, monto, metodo] of gastos) {
      const f = new Date(); f.setDate(f.getDate() - d); f.setHours(d === 0 ? Math.max(9, new Date().getHours() - 1) : 12, 0, 0, 0)
      await db.gastos.add({ fecha: Math.min(f.getTime(), ahora - 60000), categoria, descripcion, monto, metodo })
    }
  })
  await setConfig({ onboarded: true, demo: true })
}
