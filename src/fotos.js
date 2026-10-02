/* Fotos de prendas: se guardan como Blob en IndexedDB (más livianas que un dataURL)
 * y se convierten a dataURL solo para el backup y el catálogo web. */

export const esDataUrl = (s) => typeof s === 'string' && s.startsWith('data:')

/** dataURL base64 → Blob, sincrónico (sirve dentro de una migración de Dexie). */
export function dataUrlToBlob(dataUrl) {
  const [head, b64 = ''] = dataUrl.split(',')
  const type = /data:([^;]+)/.exec(head)?.[1] || 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(bin)}`
}

/** Normaliza lo que haya en `foto` (Blob, dataURL o nada) a Blob o null. */
export const fotoABlob = (f) => (f instanceof Blob ? f : esDataUrl(f) ? dataUrlToBlob(f) : null)

/** Normaliza `foto` a dataURL (para backup / HTML). */
export const fotoADataUrl = async (f) => (f instanceof Blob ? blobToDataUrl(f) : esDataUrl(f) ? f : null)

export function fotoAFile(f, name) {
  const blob = fotoABlob(f)
  return blob ? new File([blob], name, { type: blob.type || 'image/jpeg' }) : null
}
