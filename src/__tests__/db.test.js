import { describe, it, expect } from 'vitest'
import {
  db, registrarVenta, anularVenta, devolverItems, cobrarDeuda, compensarDeudaConSaldo, saldoAFavor,
  cargarSaldoAFavor, devolverSaldoAFavor, editarVenta, registrarIngreso, actualizarPrecios, nuevoPrecio,
  calcDevolucion, exportarBackup, importarBackup, validarBackup, migrarTablasV1, deudaPorClienta,
} from '../db'

async function prenda({ precio = 10000, costo = 4000, stock = { S: 3, M: 3 } } = {}) {
  const productoId = await db.productos.add({ nombre: 'Remera', categoria: 'Remeras y tops', precio, costo, activo: 1, creado: Date.now() })
  const vars = {}
  for (const [talle, s] of Object.entries(stock)) vars[talle] = await db.variantes.add({ productoId, talle, color: '', stock: s })
  return { productoId, vars }
}

const item = (p, talle, cantidad = 1, precio = 10000, costo = 4000) =>
  ({ productoId: p.productoId, varianteId: p.vars[talle], nombre: 'Remera', talle, color: '', precio, costo, categoria: 'Remeras y tops', cantidad })

const venta = (items, pagos, extra = {}) => {
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  return { items, subtotal, descuento: 0, recargo: 0, total: subtotal, pagos, clientaId: null, canal: 'local', nota: '', entregada: true, ...extra }
}

const stock = async (vid) => (await db.variantes.get(vid)).stock
const cobrosNetos = async () => (await db.cobros.toArray()).reduce((s, c) => s + c.monto, 0)

describe('registrarVenta', () => {
  it('descuenta stock y registra cobros', async () => {
    const p = await prenda()
    const id = await registrarVenta(venta([item(p, 'S', 2)], [{ metodo: 'efectivo', monto: 20000 }]))
    expect(await stock(p.vars.S)).toBe(1)
    expect((await db.ventas.get(id)).estado).toBe('pagada')
    expect(await cobrosNetos()).toBe(20000)
  })

  it('rechaza la venta si no alcanza el stock y no toca nada', async () => {
    const p = await prenda({ stock: { S: 1, M: 3 } })
    await expect(registrarVenta(venta([item(p, 'S', 2), item(p, 'M', 1)], [{ metodo: 'efectivo', monto: 30000 }]))).rejects.toThrow(/stock/)
    expect(await stock(p.vars.S)).toBe(1)
    expect(await stock(p.vars.M)).toBe(3)
    expect(await db.ventas.count()).toBe(0)
  })

  it('no deja saldo pendiente sin clienta', async () => {
    const p = await prenda()
    await expect(registrarVenta(venta([item(p, 'S')], [{ metodo: 'efectivo', monto: 4000 }]))).rejects.toThrow(/clienta/)
  })

  it('no guarda la foto dentro de la venta', async () => {
    const p = await prenda()
    const id = await registrarVenta(venta([{ ...item(p, 'S'), foto: 'data:image/jpeg;base64,AAAA', max: 3 }], [{ metodo: 'efectivo', monto: 10000 }]))
    const v = await db.ventas.get(id)
    expect(v.items[0].foto).toBeUndefined()
    expect(v.items[0].max).toBeUndefined()
  })
})

describe('anularVenta', () => {
  it('no borra los cobros originales: registra un reintegro hoy', async () => {
    const p = await prenda()
    const id = await registrarVenta(venta([item(p, 'S')], [{ metodo: 'transferencia', monto: 10000 }]))
    const viejo = Date.now() - 5 * 86400000
    await db.cobros.where('ventaId').equals(id).modify({ fecha: viejo })
    await db.ventas.update(id, { fecha: viejo })

    await anularVenta(id, { tipo: 'reintegro', metodo: 'transferencia' })
    const cobros = await db.cobros.toArray()
    expect(cobros.find((c) => c.tipo === 'venta').fecha).toBe(viejo)
    const reintegro = cobros.find((c) => c.tipo === 'reintegro')
    expect(reintegro.monto).toBe(-10000)
    expect(reintegro.fecha).toBeGreaterThan(viejo)
    expect(await stock(p.vars.S)).toBe(3)
    expect((await db.ventas.get(id)).anulada).toBe(1)
  })

  it('lo cobrado con pagos a cuenta no se pierde: puede quedar como saldo a favor', async () => {
    const p = await prenda()
    const clientaId = await db.clientas.add({ nombre: 'Lu', telefono: '', creado: Date.now() })
    const id = await registrarVenta(venta([item(p, 'S')], [{ metodo: 'efectivo', monto: 3000 }], { clientaId }))
    await cobrarDeuda(clientaId, 5000, 'efectivo')
    expect((await db.ventas.get(id)).saldo).toBe(2000)

    await anularVenta(id, { tipo: 'afavor' })
    expect(await saldoAFavor(clientaId)).toBe(8000)
    expect((await db.ventas.get(id)).saldo).toBe(0)
    expect(await deudaPorClienta()).toEqual({})
  })

  it('pide clienta para dejar saldo a favor', async () => {
    const p = await prenda()
    const id = await registrarVenta(venta([item(p, 'S')], [{ metodo: 'efectivo', monto: 10000 }]))
    await expect(anularVenta(id, { tipo: 'afavor' })).rejects.toThrow(/clienta/)
    expect((await db.ventas.get(id)).anulada).toBe(0)
  })
})

describe('devoluciones y cambios', () => {
  it('devolución parcial prorratea el descuento y baja primero la deuda', async () => {
    const p = await prenda()
    const clientaId = await db.clientas.add({ nombre: 'Cami', creado: Date.now() })
    const items = [item(p, 'S'), item(p, 'M')]
    const id = await registrarVenta({ ...venta(items, [{ metodo: 'efectivo', monto: 10000 }], { clientaId }), descuento: 2000, total: 18000 })
    expect((await db.ventas.get(id)).saldo).toBe(8000)

    const r = await devolverItems(id, [{ idx: 1, cantidad: 1 }], { tipo: 'reintegro', metodo: 'efectivo' })
    expect(r.valor).toBe(9000)
    expect(r.aSaldo).toBe(8000)
    expect(r.resto).toBe(1000)
    const v = await db.ventas.get(id)
    expect(v.saldo).toBe(0)
    expect(v.items[1].devuelto).toBe(1)
    expect(await stock(p.vars.M)).toBe(3)
    expect(await cobrosNetos()).toBe(9000)
  })

  it('la última devolución se lleva el resto exacto', async () => {
    const p = await prenda()
    const items = [item(p, 'S'), item(p, 'S'), item(p, 'M')]
    const id = await registrarVenta({ ...venta(items, [{ metodo: 'efectivo', monto: 29999 }]), total: 29999 })
    await devolverItems(id, [{ idx: 0, cantidad: 1 }], { tipo: 'reintegro', metodo: 'efectivo' })
    await devolverItems(id, [{ idx: 1, cantidad: 1 }], { tipo: 'reintegro', metodo: 'efectivo' })
    await devolverItems(id, [{ idx: 2, cantidad: 1 }], { tipo: 'reintegro', metodo: 'efectivo' })
    expect(await cobrosNetos()).toBe(0)
    expect((await db.ventas.get(id)).estado).toBe('devuelta')
  })

  it('cambio: devuelve la prenda y su valor paga la nueva venta en una sola operación', async () => {
    const p = await prenda()
    const orig = await registrarVenta(venta([item(p, 'S')], [{ metodo: 'efectivo', monto: 10000 }]))
    const dev = calcDevolucion(await db.ventas.get(orig), [{ idx: 0, cantidad: 1 }])
    expect(dev.resto).toBe(10000)

    const nueva = await registrarVenta(
      venta([item(p, 'M', 1, 12000)], [{ metodo: 'cambio', monto: 10000 }, { metodo: 'efectivo', monto: 2000 }]),
      { cambio: { ventaId: orig, lineas: [{ idx: 0, cantidad: 1 }] } },
    )
    expect(await stock(p.vars.S)).toBe(3)
    expect(await stock(p.vars.M)).toBe(2)
    expect(await cobrosNetos()).toBe(12000)
    expect((await db.ventas.get(nueva)).cambioDe).toBe(orig)
    const d = (await db.devoluciones.toArray())[0]
    expect(d.cambioVentaId).toBe(nueva)
  })

  it('cambio por algo más barato: el excedente se reintegra', async () => {
    const p = await prenda()
    const orig = await registrarVenta(venta([item(p, 'S')], [{ metodo: 'efectivo', monto: 10000 }]))
    await registrarVenta(
      venta([item(p, 'M', 1, 7000)], [{ metodo: 'cambio', monto: 7000 }]),
      { cambio: { ventaId: orig, lineas: [{ idx: 0, cantidad: 1 }], excedente: { tipo: 'reintegro', metodo: 'efectivo' } } },
    )
    expect(await cobrosNetos()).toBe(7000)
  })

  it('si el cambio falla por stock, la venta original queda intacta', async () => {
    const p = await prenda({ stock: { S: 3, M: 0 } })
    const orig = await registrarVenta(venta([item(p, 'S')], [{ metodo: 'efectivo', monto: 10000 }]))
    await expect(registrarVenta(
      venta([item(p, 'M')], [{ metodo: 'cambio', monto: 10000 }]),
      { cambio: { ventaId: orig, lineas: [{ idx: 0, cantidad: 1 }] } },
    )).rejects.toThrow(/stock/)
    expect((await db.ventas.get(orig)).items[0].devuelto).toBe(0)
    expect(await stock(p.vars.S)).toBe(2)
    expect(await db.devoluciones.count()).toBe(0)
  })
})

describe('saldo a favor', () => {
  it('pagar de más deja saldo a favor y se puede usar en otra venta', async () => {
    const p = await prenda()
    const clientaId = await db.clientas.add({ nombre: 'Flor', creado: Date.now() })
    await registrarVenta(venta([item(p, 'S')], [], { clientaId }))
    const r = await cobrarDeuda(clientaId, 15000, 'transferencia')
    expect(r).toEqual({ aplicado: 10000, aFavor: 5000 })
    expect(await saldoAFavor(clientaId)).toBe(5000)

    await registrarVenta(venta([item(p, 'M')], [{ metodo: 'afavor', monto: 5000 }, { metodo: 'efectivo', monto: 5000 }], { clientaId }))
    expect(await saldoAFavor(clientaId)).toBe(0)
    expect(await cobrosNetos()).toBe(20000)
  })

  it('no deja usar más saldo del que hay', async () => {
    const p = await prenda()
    const clientaId = await db.clientas.add({ nombre: 'Flor', creado: Date.now() })
    await cargarSaldoAFavor(clientaId, 3000, 'efectivo')
    await expect(registrarVenta(venta([item(p, 'S')], [{ metodo: 'afavor', monto: 5000 }, { metodo: 'efectivo', monto: 5000 }], { clientaId }))).rejects.toThrow(/saldo a favor/)
  })

  it('compensar deuda con saldo y devolver el sobrante', async () => {
    const p = await prenda()
    const clientaId = await db.clientas.add({ nombre: 'Agus', creado: Date.now() })
    await cargarSaldoAFavor(clientaId, 15000, 'efectivo')
    await registrarVenta(venta([item(p, 'S')], [], { clientaId }))
    expect(await compensarDeudaConSaldo(clientaId)).toBe(10000)
    expect(await deudaPorClienta()).toEqual({})
    await devolverSaldoAFavor(clientaId, 5000, 'efectivo')
    expect(await saldoAFavor(clientaId)).toBe(0)
    expect(await cobrosNetos()).toBe(10000)
  })
})

describe('editarVenta', () => {
  it('cambia el medio de pago también en la caja', async () => {
    const p = await prenda()
    const id = await registrarVenta(venta([item(p, 'S')], [{ metodo: 'efectivo', monto: 10000 }]))
    await editarVenta(id, { metodos: { 0: 'transferencia' }, canal: 'instagram' })
    const v = await db.ventas.get(id)
    expect(v.pagos[0].metodo).toBe('transferencia')
    expect(v.canal).toBe('instagram')
    expect((await db.cobros.toArray())[0].metodo).toBe('transferencia')
  })

  it('no deja una venta con deuda sin clienta', async () => {
    const p = await prenda()
    const clientaId = await db.clientas.add({ nombre: 'Mica', creado: Date.now() })
    const id = await registrarVenta(venta([item(p, 'S')], [], { clientaId }))
    await expect(editarVenta(id, { clientaId: null })).rejects.toThrow(/saldo/)
  })
})

describe('mercadería y precios', () => {
  it('el ingreso suma stock, actualiza costo y anota el gasto', async () => {
    const p = await prenda()
    await registrarIngreso({ proveedor: 'Flores', items: [{ productoId: p.productoId, varianteId: p.vars.S, cantidad: 5, costo: 4500 }], gastoMetodo: 'transferencia' })
    expect(await stock(p.vars.S)).toBe(8)
    expect((await db.productos.get(p.productoId)).costo).toBe(4500)
    const g = await db.gastos.toArray()
    expect(g[0]).toMatchObject({ categoria: 'Mercadería', monto: 22500, metodo: 'transferencia' })
  })

  it('suba en bloque con redondeo', async () => {
    expect(nuevoPrecio(18900, 12, 500)).toBe(21000)
    expect(nuevoPrecio(18900, 12, 100)).toBe(21200)
    expect(nuevoPrecio(10000, -10, 0)).toBe(9000)
    const p = await prenda({ precio: 18900 })
    expect(await actualizarPrecios([p.productoId], 12, 500)).toBe(1)
    expect(await db.productos.get(p.productoId)).toMatchObject({ precio: 21000, precioAnterior: 18900 })
  })
})

describe('backup', () => {
  it('ida y vuelta conserva todo', async () => {
    const p = await prenda()
    await registrarVenta(venta([item(p, 'S')], [{ metodo: 'efectivo', monto: 10000 }]))
    const data = JSON.parse(JSON.stringify(await exportarBackup()))
    expect(data.version).toBe(2)
    await db.ventas.clear()
    await importarBackup(data)
    expect(await db.ventas.count()).toBe(1)
  })

  it('rechaza backups de una versión más nueva', () => {
    expect(() => validarBackup({ app: 'autenticas', version: 99, tablas: { productos: [], ventas: [] } })).toThrow(/más nueva/)
    expect(() => validarBackup({ app: 'otra', tablas: {} })).toThrow(/no es un backup/)
  })

  it('migra un backup v1: fondos fuera de config y pagos a cuenta reconstruidos', async () => {
    const v1 = {
      app: 'autenticas', version: 1,
      tablas: {
        productos: [], variantes: [], clientas: [{ id: 1, nombre: 'Lu' }], cobros: [], gastos: [], cierres: [],
        config: [{ key: 'onboarded', value: true }, { key: 'fondo_2026-09-30', value: 5000 }],
        ventas: [{ id: 1, fecha: 1, clientaId: 1, items: [{ nombre: 'x', precio: 100, cantidad: 1, foto: 'data:image/jpeg;base64,AAAA' }], total: 100, pagos: [{ metodo: 'efectivo', monto: 40 }], saldo: 20, estado: 'debe', anulada: 0 }],
      },
    }
    const m = migrarTablasV1(v1.tablas)
    expect(m.ventas[0].cuenta).toBe(40)
    expect(m.ventas[0].items[0].foto).toBeUndefined()
    await importarBackup(v1)
    expect(await db.fondos.get('2026-09-30')).toEqual({ dia: '2026-09-30', monto: 5000 })
    expect(await db.config.get('fondo_2026-09-30')).toBeUndefined()
  })
})

describe('migración de la base instalada', () => {
  it('una base v1 existente se actualiza a v2 sin perder datos', async () => {
    const { default: Dexie } = await import('dexie')
    db.close()
    await db.delete()
    const vieja = new Dexie('autenticas')
    vieja.version(1).stores({
      productos: '++id, nombre, categoria, activo, creado', variantes: '++id, productoId, [productoId+talle+color]',
      clientas: '++id, nombre, telefono, creado', ventas: '++id, fecha, clientaId, estado, anulada',
      cobros: '++id, fecha, ventaId, clientaId, metodo, tipo', gastos: '++id, fecha, categoria, metodo', cierres: '++id, fecha', config: 'key',
    })
    await vieja.open()
    await vieja.table('config').bulkPut([{ key: 'onboarded', value: true }, { key: 'fondo_2026-10-01', value: 12000 }])
    await vieja.table('ventas').add({ fecha: 1, clientaId: 1, items: [{ nombre: 'x', precio: 100, cantidad: 1 }], total: 100, pagos: [], saldo: 30, estado: 'debe', anulada: 0 })
    vieja.close()

    await db.open()
    expect(db.verno).toBe(2)
    expect((await db.ventas.toArray())[0].cuenta).toBe(70)
    expect(await db.fondos.get('2026-10-01')).toEqual({ dia: '2026-10-01', monto: 12000 })
    expect((await db.config.get('onboarded')).value).toBe(true)
  })
})
