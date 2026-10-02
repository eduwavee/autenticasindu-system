/* Textos que salen de la app (WhatsApp, catálogo web): siempre con montos visibles (moneyTxt). */
import { METODO_LABEL } from './db'
import { moneyTxt as $, fecha, hora } from './utils'

const nombreCorto = (n = '') => n.trim().split(/\s+/)[0] || ''

export function textoTicket(v, clienta, cfg) {
  const l = [`*${cfg.tienda}* · Comprobante #${v.id}`, `${fecha(v.fecha)} ${hora(v.fecha)}`, '']
  v.items.forEach((i) => {
    l.push(`• ${i.nombre} (${i.talle}${i.color ? ' · ' + i.color : ''}) x${i.cantidad} — ${$(i.precio * i.cantidad)}`)
    if (i.devuelto) l.push(`   ↩ devuelta${i.devuelto < i.cantidad ? ` x${i.devuelto}` : ''}`)
  })
  l.push('')
  if (v.descuento) l.push(`Descuento: −${$(v.descuento)}`)
  if (v.recargo) l.push(`Recargo: +${$(v.recargo)}`)
  l.push(`*Total: ${$(v.total)}*`)
  v.pagos.forEach((p) => l.push(`${METODO_LABEL[p.metodo] || p.metodo}: ${$(p.monto)}`))
  if (v.devuelto) l.push(`Devuelto: −${$(v.devuelto)}`)
  if (v.saldo > 0) l.push(`Saldo pendiente: ${$(v.saldo)}`)
  l.push('', `¡Gracias${clienta ? ', ' + nombreCorto(clienta.nombre) : ''}! 💗`)
  if (cfg.instagram) l.push(`instagram.com/${cfg.instagram}`)
  return l.join('\n')
}

export function textoRecordatorio(c, deuda, cfg) {
  return `Hola ${nombreCorto(c.nombre)}! 💗 Te escribo de ${cfg.tienda}. Te recuerdo que tenés un saldo pendiente de ${$(deuda)}.${cfg.alias ? ` Podés transferir al alias *${cfg.alias}*.` : ''} ¡Gracias!`
}

/** Mensaje para reactivar a una clienta: prendas con stock en su talle. */
export function textoNovedades(c, prendas, talle, cfg) {
  const l = [`Hola ${nombreCorto(c.nombre)}! 💗 ¿Cómo estás? Te escribo de ${cfg.tienda}.`]
  if (prendas.length) {
    l.push('', `Entraron cosas${talle ? ` en tu talle (${talle})` : ''} que creo que te van a gustar:`, '')
    prendas.forEach((p) => l.push(`• ${p.nombre} — ${$(p.precio)}`))
    l.push('', '¿Te reservo alguna?')
  } else {
    l.push('Hace rato no te vemos por acá, ¡pasá a ver lo nuevo!')
  }
  if (cfg.instagram) l.push(`instagram.com/${cfg.instagram}`)
  return l.join('\n')
}

export function textoCumple(c, cfg) {
  return `¡Feliz cumple, ${nombreCorto(c.nombre)}! 🎂💗 Te saludamos desde ${cfg.tienda}.${cfg.descuentoEfectivo ? ' Esta semana tenés un regalito: pasá y preguntanos.' : ''}`
}

export const tallesDisp = (p) => [...new Set(p.variantes.filter((v) => v.stock > 0).map((v) => v.talle))]
export const coloresDisp = (p) => [...new Set(p.variantes.filter((v) => v.stock > 0 && v.color).map((v) => v.color))]

export function textoCatalogo(lista, cfg) {
  const l = [`✨ *${cfg.tienda}* · Disponibles hoy`, '']
  lista.forEach((p) => {
    l.push(`*${p.nombre}* — ${$(p.precio)}`)
    l.push(`Talles: ${tallesDisp(p).join(', ')}${coloresDisp(p).length ? ` · ${coloresDisp(p).join(', ')}` : ''}`)
    l.push('')
  })
  if (cfg.descuentoEfectivo) l.push(`💸 ${cfg.descuentoEfectivo}% off pagando en efectivo`)
  l.push('Respondé este mensaje con la prenda y el talle para reservarla 💗')
  if (cfg.instagram) l.push(`instagram.com/${cfg.instagram}`)
  return l.join('\n')
}

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/** fotos: { [productoId]: dataURL } */
export function htmlCatalogo(lista, cfg, fotos = {}) {
  const tel = (cfg.whatsapp || '').replace(/\D/g, '')
  const wa = (p) => `https://wa.me/${tel ? (tel.startsWith('54') ? tel : '549' + tel) : ''}?text=${encodeURIComponent(`Hola! Me interesa ${p.nombre} (${$(p.precio)}). ¿Qué talles tenés?`)}`
  const cards = lista.map((p) => `
    <article class="t"><span class="e"></span><div class="f">
      <div class="i">${fotos[p.id] ? `<img src="${fotos[p.id]}" alt="${esc(p.nombre)}" loading="lazy">` : '<div class="ph"><svg viewBox="0 0 64 64" width="40%" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M23 10 L12 16 L6 28 L14 32 L18 27 V56 H46 V27 L50 32 L58 28 L52 16 L41 10 Q32 18 23 10 Z"/></svg></div>'}</div>
      <h2>${esc(p.nombre)}</h2>
      <p class="p">${$(p.precio)}</p>
      <p class="s">Talles: ${esc(tallesDisp(p).join(' · '))}${coloresDisp(p).length ? `<br>${esc(coloresDisp(p).join(' · '))}` : ''}</p>
      ${p.descripcion ? `<p class="d">${esc(p.descripcion)}</p>` : ''}
      <a class="b" href="${wa(p)}" target="_blank" rel="noopener">Pedir por WhatsApp</a>
    </div></article>`).join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(cfg.tienda)} · Catálogo</title><style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#fffafc;color:#2b1320}
header{background:#a8235a;color:#fff;padding:28px 16px 34px;text-align:center}header h1{margin:0;font-size:2rem;letter-spacing:-.02em}header p{margin:6px 0 0;color:#f8cfe0}
main{max-width:1100px;margin:0 auto;padding:24px 16px 48px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:22px 16px}
.t{position:relative;filter:drop-shadow(0 1px 1px rgb(107 18 56/.08)) drop-shadow(0 6px 12px rgb(107 18 56/.08))}
.f{background:#fff;clip-path:polygon(18px 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%,0 18px);border-radius:0 0 12px 12px;padding:34px 14px 16px;height:100%;display:flex;flex-direction:column;gap:6px}
.e{position:absolute;top:11px;left:50%;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#fffafc;box-shadow:inset 0 1px 2px rgb(107 18 56/.25),0 0 0 3px #fce6ef;z-index:2}
.i{aspect-ratio:4/5;border-radius:8px;overflow:hidden;background:#fff3f8}.i img{width:100%;height:100%;object-fit:cover}.ph{height:100%;display:grid;place-items:center;font-size:3rem;color:#f3a6c6}
h2{font-size:1rem;margin:6px 0 0}.p{margin:0;font-weight:800;color:#8a1a49;font-size:1.15rem}.s,.d{margin:0;font-size:.85rem;color:#6f4a5c}
.b{margin-top:auto;display:block;text-align:center;background:#a8235a;color:#fff;text-decoration:none;font-weight:700;padding:11px;border-radius:10px}
footer{text-align:center;padding:0 16px 32px;color:#6f4a5c;font-size:.85rem}footer a{color:#a8235a}
</style></head><body><header><h1>${esc(cfg.tienda)}</h1><p>Catálogo · ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</p></header>
<main>${cards}</main><footer>${cfg.instagram ? `<a href="https://instagram.com/${esc(cfg.instagram)}">@${esc(cfg.instagram)}</a> · ` : ''}Precios y stock sujetos a disponibilidad.</footer></body></html>`
}
