const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/* Modo discreto: oculta los montos en pantalla (el celular queda en el mostrador).
 * Lo prende App según la configuración; los textos que salen (WhatsApp, catálogo) usan moneyTxt. */
let discreto = false
export const setDiscreto = (v) => { discreto = !!v }

/** Monto en texto plano, siempre visible (mensajes, catálogo, comprobantes). */
export const moneyTxt = (n) => {
  const r = Math.round(n || 0)
  return `${r < 0 ? '−' : ''}$${nf.format(Math.abs(r))}`
}
/** Monto para mostrar en pantalla: respeta el modo discreto. */
export const money = (n) => (discreto ? '$ •••••' : moneyTxt(n))
export const num = (n) => nf.format(Math.round(n || 0))

export const DIA = 86400000
/** Marca de tiempo actual (para usar en manejadores de eventos). */
export const ahora = () => Date.now()
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
export const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime() }
/** 'AAAA-MM-DD' local → Date a las 00:00 locales. */
export const isoADate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
export const dateAIso = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
export const hoyISO = () => dateAIso(new Date())

const fCorta = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

/** id: hoy | semana | mes | mesAnterior | rango (con desdeIso/hastaIso) */
export function periodo(id, desdeIso, hastaIso) {
  const now = new Date()
  if (id === 'hoy') return { id, desde: startOfDay(now), hasta: endOfDay(now), label: 'Hoy' }
  if (id === 'semana') { const d = new Date(now); d.setDate(d.getDate() - 6); return { id, desde: startOfDay(d), hasta: endOfDay(now), label: 'Últimos 7 días' } }
  if (id === 'mes') return { id, desde: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), hasta: endOfDay(now), label: 'Este mes' }
  if (id === 'mesAnterior') {
    const a = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const b = new Date(now.getFullYear(), now.getMonth(), 0)
    return { id, desde: startOfDay(a), hasta: endOfDay(b), label: 'Mes anterior' }
  }
  if (id === 'rango' && desdeIso && hastaIso) {
    const [a, b] = [isoADate(desdeIso), isoADate(hastaIso)].sort((x, y) => x - y)
    return { id, desde: startOfDay(a), hasta: endOfDay(b), label: `${fCorta.format(a)} – ${fCorta.format(b)}`.replace(/\./g, '') }
  }
  return periodo('hoy')
}

/** Período con el que se compara: el mes anterior hasta el mismo día, o la misma cantidad de días justo antes. */
export function periodoAnterior(p) {
  if (p.id === 'mes') {
    const hoy = new Date(p.hasta)
    const a = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate()
    const b = new Date(hoy.getFullYear(), hoy.getMonth() - 1, Math.min(hoy.getDate(), finMes))
    return { desde: startOfDay(a), hasta: endOfDay(b), label: 'mismo período del mes anterior' }
  }
  if (p.id === 'mesAnterior') {
    const a = new Date(p.desde)
    return { desde: startOfDay(new Date(a.getFullYear(), a.getMonth() - 1, 1)), hasta: endOfDay(new Date(a.getFullYear(), a.getMonth(), 0)), label: 'el mes previo' }
  }
  const dias = Math.round((startOfDay(p.hasta) - startOfDay(p.desde)) / DIA) + 1
  const hasta = new Date(p.desde); hasta.setDate(hasta.getDate() - 1)
  const desde = new Date(p.desde); desde.setDate(desde.getDate() - dias)
  return { desde: startOfDay(desde), hasta: endOfDay(hasta), label: dias === 1 ? 'ayer' : `los ${dias} días anteriores` }
}

/** Variación porcentual redondeada, o null si no hay base para comparar. */
export const variacion = (actual, antes) => (antes > 0 ? Math.round(((actual - antes) / antes) * 100) : null)

const fHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })
const fLarga = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

export const fecha = (t) => fCorta.format(new Date(t)).replace('.', '')
export const hora = (t) => fHora.format(new Date(t))
export const fechaLarga = (t = Date.now()) => { const s = fLarga.format(new Date(t)); return s.charAt(0).toUpperCase() + s.slice(1) }

export function fechaRelativa(t) {
  const hoy = startOfDay()
  if (t >= hoy) return `Hoy ${hora(t)}`
  if (t >= hoy - DIA) return `Ayer ${hora(t)}`
  return `${fecha(t)} ${hora(t)}`
}

export const diasDesde = (t, ahora = Date.now()) => Math.floor((startOfDay(ahora) - startOfDay(t)) / DIA)

export const parseMonto = (s) => {
  const n = Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function waLink(telefono, texto) {
  const tel = String(telefono || '').replace(/\D/g, '')
  const base = tel ? `https://wa.me/${tel.startsWith('54') ? tel : '549' + tel}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(texto)}`
}

/** Achica una imagen a máx `max` px y la devuelve como Blob JPEG. */
export function comprimirImagen(file, max = 720, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * r)
      c.height = Math.round(img.height * r)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')) }
    img.src = url
  })
}

export function descargar(nombre, contenido, tipo = 'application/json') {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
}

/** Comparte un archivo con la hoja de compartir del celular (WhatsApp, Drive…). Devuelve false si no se puede. */
export async function compartirArchivo(nombre, contenido, tipo, texto) {
  const file = new File([contenido], nombre, { type: tipo })
  if (!navigator.canShare?.({ files: [file] })) return false
  await navigator.share({ files: [file], title: nombre, text: texto })
  return true
}

export const initials = (n = '') => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'

export const COLOR_HEX = {
  negro: '#1d1a1c', blanco: '#ffffff', rosa: '#f29bbd', 'rosa viejo': '#d7a0a6', fucsia: '#d6246e', rojo: '#c62828', bordo: '#6d1a2c',
  nude: '#e5c4ad', beige: '#d9c3a3', camel: '#b8854f', marron: '#6b4a32', marrón: '#6b4a32', gris: '#9a9497', azul: '#2c4f8c', celeste: '#9cc7e8',
  verde: '#3f7a4f', 'verde oliva': '#6b6b3a', lila: '#b9a2d8', amarillo: '#f1cc4b', naranja: '#e98b3a', crudo: '#efe7d6', jean: '#4a6a93', denim: '#4a6a93',
}
export const colorHex = (c = '') => COLOR_HEX[c.trim().toLowerCase()] || '#e9dbe2'

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const textoCumpleCorto = (mmdd) => { const [m, d] = (mmdd || '').split('-').map(Number); return m && d ? `${d} de ${MESES[m - 1]}` : '' }

/** Cumpleaños guardado como 'MM-DD'. Devuelve cuántos días faltan (0 = hoy). */
export function diasParaCumple(mmdd, ahora = new Date()) {
  if (!/^\d{2}-\d{2}$/.test(mmdd || '')) return null
  const [m, d] = mmdd.split('-').map(Number)
  const hoy = startOfDay(ahora)
  let c = startOfDay(new Date(ahora.getFullYear(), m - 1, d))
  if (c < hoy) c = startOfDay(new Date(ahora.getFullYear() + 1, m - 1, d))
  return Math.round((c - hoy) / DIA)
}

/** Código que llevan las etiquetas QR: un link a la app que agrega esa variante al carrito. */
export const codigoVariante = (vid) => `${location.origin}${location.pathname}#/vender?v=${vid}`
/** Lee un código escaneado o tipeado: link de etiqueta, "V123" o solo el número. */
export function leerCodigo(texto) {
  const s = String(texto || '').trim()
  const m = /[?&]v=(\d+)/.exec(s) || /^v?(\d+)$/i.exec(s)
  return m ? Number(m[1]) : null
}
