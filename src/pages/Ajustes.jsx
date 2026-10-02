import { useEffect, useRef, useState } from 'react'
import { Download, Upload, Trash2, Smartphone, ShieldCheck, Share2, Lock, EyeOff } from 'lucide-react'
import { setConfig, exportarBackup, importarBackup, validarBackup, borrarTodo, hashPin } from '../db'
import { useConfig } from '../store'
import { Page } from '../layout'
import { Confirm, MoneyInput, Sheet, useToast } from '../ui'
import { descargar, compartirArchivo, hoyISO, fechaRelativa } from '../utils'
import { PinPad } from './Bloqueo'

function CrearPin({ onClose }) {
  const toast = useToast()
  const [paso, setPaso] = useState(1)
  const [primero, setPrimero] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const completo = async (v) => {
    if (paso === 1) { setPrimero(v); setPin(''); setPaso(2); return }
    if (v !== primero) { setError(true); setTimeout(() => { setError(false); setPin(''); setPaso(1); setPrimero('') }, 600); return }
    const hash = await hashPin(v)
    window.dispatchEvent(new Event('autenticas:desbloquear'))
    await setConfig({ pinHash: hash })
    toast('PIN activado')
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={paso === 1 ? 'Elegí un PIN de 4 números' : 'Repetilo para confirmar'}>
      <div className="stack" style={{ alignItems: 'center' }}>
        <PinPad value={pin} onChange={setPin} onComplete={completo} error={error} />
        {error && <p className="field-error" role="alert">No coinciden. Probá de nuevo.</p>}
      </div>
    </Sheet>
  )
}

function DatosTienda({ cfg }) {
  const toast = useToast()
  const [f, setF] = useState(cfg)
  const set = (k) => (v) => setF({ ...f, [k]: v?.target ? v.target.value : v })
  const soloNum = (k) => (e) => set(k)(e.target.value.replace(/\D/g, ''))

  const guardar = async () => {
    await setConfig({
      tienda: f.tienda.trim() || 'Auténticas', instagram: f.instagram.replace('@', '').trim(), whatsapp: f.whatsapp.trim(), alias: f.alias.trim(),
      metaDiaria: Number(f.metaDiaria) || 0, descuentoEfectivo: Number(f.descuentoEfectivo) || 0, recargoCredito: Number(f.recargoCredito) || 0,
      stockBajo: Number(f.stockBajo) || 0, diasQuieta: Number(f.diasQuieta) || 60,
    })
    toast('Ajustes guardados')
  }

  return (
    <>
      <section className="stack">
        <h2 className="section-title">Datos de la tienda</h2>
        <label className="field"><span>Nombre</span><input className="input" value={f.tienda} onChange={set('tienda')} /></label>
        <div className="grid-2">
          <label className="field"><span>Instagram</span><input className="input" value={f.instagram} onChange={set('instagram')} /></label>
          <label className="field"><span>WhatsApp</span><input className="input" inputMode="tel" value={f.whatsapp} onChange={set('whatsapp')} placeholder="381 555 0000" /></label>
        </div>
        <label className="field"><span>Alias para transferencias</span><input className="input" value={f.alias} onChange={set('alias')} placeholder="autenticas.mp" /></label>
      </section>

      <section className="stack">
        <h2 className="section-title">Ventas y stock</h2>
        <label className="field"><span>Meta de venta diaria</span><MoneyInput value={f.metaDiaria} onChange={set('metaDiaria')} /></label>
        <div className="grid-2">
          <label className="field"><span>Descuento efectivo (%)</span><input className="input num" inputMode="numeric" value={f.descuentoEfectivo} onChange={soloNum('descuentoEfectivo')} /></label>
          <label className="field"><span>Recargo crédito (%)</span><input className="input num" inputMode="numeric" value={f.recargoCredito} onChange={soloNum('recargoCredito')} /></label>
        </div>
        <div className="grid-2">
          <label className="field"><span>Stock bajo con (unidades o menos)</span><input className="input num" inputMode="numeric" value={f.stockBajo} onChange={soloNum('stockBajo')} /></label>
          <label className="field"><span>Prenda quieta después de (días)</span><input className="input num" inputMode="numeric" value={f.diasQuieta} onChange={soloNum('diasQuieta')} /></label>
        </div>
        <button className="btn btn-primary btn-block" onClick={guardar}>Guardar ajustes</button>
      </section>
    </>
  )
}

export default function Ajustes() {
  const cfg = useConfig()
  const toast = useToast()
  const [confirm, setConfirm] = useState(null)
  const [pendiente, setPendiente] = useState(null)
  const [installEvt, setInstallEvt] = useState(null)
  const [crearPin, setCrearPin] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  if (!cfg) return <Page title="Ajustes" back="/mas" />

  const armarBackup = async () => ({ nombre: `backup-autenticas-${hoyISO()}.json`, json: JSON.stringify(await exportarBackup()) })

  const compartir = async () => {
    try {
      const { nombre, json } = await armarBackup()
      const ok = await compartirArchivo(nombre, json, 'application/json', `Backup de ${cfg.tienda} del ${new Date().toLocaleDateString('es-AR')}`)
      if (!ok) { descargar(nombre, json); toast('Este navegador no comparte archivos: se descargó') }
      else toast('Backup compartido')
      await setConfig({ ultimoBackup: Date.now() })
    } catch (e) { if (e?.name !== 'AbortError') toast('No se pudo compartir el backup', 'error') }
  }

  const backup = async () => {
    const { nombre, json } = await armarBackup()
    descargar(nombre, json)
    await setConfig({ ultimoBackup: Date.now() })
    toast('Backup descargado')
  }

  const leerArchivo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      validarBackup(data)
      setPendiente(data)
      setConfirm('importar')
    } catch (err) { toast(err instanceof SyntaxError ? 'Ese archivo no es un backup de la app' : err.message, 'error') }
  }

  return (
    <Page title="Ajustes y backup" back="/mas">
      <div className="stack-lg" style={{ maxWidth: 620, margin: '0 auto' }}>
        <section className="panel panel-pad stack">
          <h2 className="section-title"><ShieldCheck size={18} style={{ verticalAlign: '-3px', color: 'var(--rose-700)' }} /> Copia de seguridad</h2>
          <p className="muted">Todo se guarda en este dispositivo. Una vez por semana mandate el backup por WhatsApp o guardalo en Drive. Con ese archivo recuperás todo en otro celular.</p>
          <p className="subtle">Último backup: {cfg.ultimoBackup ? fechaRelativa(cfg.ultimoBackup) : 'nunca'}</p>
          <button className="btn btn-primary btn-block" onClick={compartir}><Share2 /> Mandar backup (WhatsApp, Drive…)</button>
          <div className="grid-2">
            <button className="btn btn-ghost" onClick={backup}><Download /> Descargar</button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Upload /> Restaurar</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={leerArchivo} />
        </section>

        <DatosTienda cfg={cfg} />

        <section className="stack">
          <h2 className="section-title">Privacidad</h2>
          <label className="row"><input type="checkbox" checked={!!cfg.discreto} onChange={(e) => setConfig({ discreto: e.target.checked })} /> <EyeOff size={18} /> Ocultar los montos en pantalla</label>
          <p className="subtle">También lo prendés y apagás con el ojo de arriba a la derecha. Los comprobantes y mensajes salen con los montos igual.</p>
          {cfg.pinHash ? (
            <div className="row wrap">
              <span className="badge badge-ok"><Lock size={14} /> PIN activado</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setCrearPin(true)}>Cambiar PIN</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm('sinpin')}>Quitar PIN</button>
            </div>
          ) : (
            <button className="btn btn-soft" onClick={() => setCrearPin(true)}><Lock /> Pedir PIN al abrir la app</button>
          )}
          <p className="subtle">Con PIN, la app lo pide al abrirla y después de 5 minutos en segundo plano. Es una traba para curiosos, no un cifrado: el backup sigue siendo tu copia segura.</p>
        </section>

        {installEvt && (
          <button className="btn btn-soft" onClick={async () => { installEvt.prompt(); setInstallEvt(null) }}><Smartphone /> Instalar la app en este dispositivo</button>
        )}
        <p className="subtle">En iPhone: abrí en Safari → Compartir → “Agregar a inicio”. En Android: menú de Chrome → “Instalar app”.</p>

        <section className="stack">
          <h2 className="section-title">Zona delicada</h2>
          <button className="btn btn-danger" onClick={() => setConfirm('borrar')}><Trash2 /> Borrar todos los datos{cfg.demo ? ' (incluye los de ejemplo)' : ''}</button>
        </section>
      </div>

      {crearPin && <CrearPin onClose={() => setCrearPin(false)} />}
      <Confirm open={confirm === 'sinpin'} onClose={() => setConfirm(null)} title="¿Quitar el PIN?" confirmLabel="Quitar"
        text="La app va a abrir directo, sin pedir PIN." onConfirm={async () => { await setConfig({ pinHash: null }); toast('PIN quitado') }} />
      <Confirm open={confirm === 'borrar'} onClose={() => setConfirm(null)} danger title="¿Borrar todo?" confirmLabel="Borrar todo"
        text="Se eliminan prendas, ventas, clientas, gastos y ajustes de este dispositivo. Mandate un backup antes si lo vas a necesitar."
        onConfirm={async () => { await borrarTodo(); window.location.hash = '#/' }} />
      <Confirm open={confirm === 'importar'} onClose={() => { setConfirm(null); setPendiente(null) }} title="¿Restaurar este backup?" confirmLabel="Restaurar"
        text={pendiente ? `Backup del ${new Date(pendiente.exportado).toLocaleString('es-AR')}. Reemplaza todos los datos actuales de este dispositivo.` : ''}
        onConfirm={async () => { await importarBackup(pendiente); toast('Backup restaurado') }} />
    </Page>
  )
}
