import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Share2, FileDown, CheckSquare } from 'lucide-react'
import { useConfig } from '../store'
import { useProductosConStock } from '../hooks'
import { Page } from '../layout'
import { Empty, EmptyRackArt, useToast } from '../ui'
import { waLink, descargar } from '../utils'
import { fotoAFile, fotoADataUrl } from '../fotos'
import { textoCatalogo, htmlCatalogo, tallesDisp } from '../textos'
import { ProductTag } from './Vender'

export default function Catalogo() {
  const productos = useProductosConStock()
  const cfg = useConfig()
  const toast = useToast()
  const [sel, setSel] = useState(new Set())
  const disponibles = useMemo(() => (productos || []).filter((p) => p.stock > 0), [productos])
  const elegidos = sel.size ? disponibles.filter((p) => sel.has(p.id)) : disponibles
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const compartirFotos = async () => {
    const conFoto = elegidos.filter((p) => p.foto).slice(0, 10)
    try {
      const files = conFoto.map((p, i) => fotoAFile(p.foto, `${i + 1}-${p.nombre.replace(/\W+/g, '-')}.jpg`)).filter(Boolean)
      const payload = { title: cfg.tienda, text: textoCatalogo(elegidos, cfg) }
      if (files.length && navigator.canShare?.({ files })) payload.files = files
      if (navigator.share) await navigator.share(payload)
      else { await navigator.clipboard.writeText(payload.text); toast('Texto copiado: pegalo en WhatsApp o Instagram') }
    } catch (e) { if (e?.name !== 'AbortError') toast('No se pudo compartir desde este navegador', 'error') }
  }

  const catalogoWeb = async () => {
    const fotos = Object.fromEntries(await Promise.all(elegidos.filter((p) => p.foto).map(async (p) => [p.id, await fotoADataUrl(p.foto)])))
    descargar(`catalogo-${cfg.tienda.toLowerCase().replace(/\W+/g, '-')}.html`, htmlCatalogo(elegidos, cfg, fotos), 'text/html')
    toast('Catálogo descargado')
  }

  if (!cfg) return null
  return (
    <Page title="Catálogo" back="/mas" wide>
      <div className="stack-lg">
        {productos && !disponibles.length ? (
          <Empty art={<EmptyRackArt />} title="No hay prendas con stock" text="El catálogo muestra solo lo que tenés disponible." action={<Link className="btn btn-primary" to="/stock/nuevo">Cargar prenda</Link>} />
        ) : (
          <>
            <div className="panel panel-pad stack">
              <div className="row-between">
                <p><b>{sel.size ? `${sel.size} seleccionadas` : `Todas las disponibles (${disponibles.length})`}</b><br /><span className="subtle">Tocá prendas para elegir cuáles compartir.</span></p>
                {sel.size > 0 && <button className="link-btn" onClick={() => setSel(new Set())}>Limpiar</button>}
              </div>
              <div className="row wrap">
                <a className="btn btn-wa" href={waLink('', textoCatalogo(elegidos, cfg))} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
                <button className="btn btn-soft" onClick={compartirFotos}><Share2 /> Compartir con fotos</button>
                <button className="btn btn-ghost" onClick={catalogoWeb}><FileDown /> Catálogo web</button>
              </div>
              {!cfg.whatsapp && <p className="subtle">Tip: cargá el WhatsApp de la tienda en <Link to="/ajustes">Ajustes</Link> para que el catálogo web tenga el botón “Pedir”.</p>}
            </div>
            <div className="tag-grid">
              {disponibles.map((p) => (
                <ProductTag key={p.id} p={p} selected={sel.has(p.id)} onClick={() => toggle(p.id)}>
                  <span className="subtle ellipsis">{tallesDisp(p).join(' · ')}</span>
                </ProductTag>
              ))}
            </div>
            {sel.size === 0 && <p className="subtle row" style={{ justifyContent: 'center' }}><CheckSquare size={16} /> Sin selección se comparte todo lo disponible.</p>}
          </>
        )}
      </div>
    </Page>
  )
}
