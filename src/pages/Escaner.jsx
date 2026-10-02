import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../ui'

// eslint-disable-next-line react-refresh/only-export-components
export const puedeEscanear = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia

/** Lector de QR con la cámara (Chrome en Android). En iPhone se usa la cámara del sistema: el QR abre la app. */
export default function Escaner({ onDetect, onClose }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  // La cámara se abre una sola vez; el callback se lee de un ref para no reiniciarla si cambia.
  const detectar = useRef(onDetect)
  useEffect(() => { detectar.current = onDetect }, [onDetect])

  useEffect(() => {
    let stream, timer, vivo = true
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!vivo) return
        video.current.srcObject = stream
        await video.current.play()
        const det = new window.BarcodeDetector({ formats: ['qr_code'] })
        const leer = async () => {
          if (!vivo) return
          try {
            const [c] = await det.detect(video.current)
            if (c?.rawValue) { detectar.current(c.rawValue); return }
          } catch { /* cuadro sin imagen todavía */ }
          timer = setTimeout(leer, 250)
        }
        leer()
      } catch {
        setError('No se pudo abrir la cámara. Revisá el permiso de cámara del navegador.')
      }
    })()
    return () => { vivo = false; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  return (
    <Sheet open onClose={onClose} title="Escanear etiqueta">
      <div className="stack">
        {error ? <p className="field-error" role="alert">{error}</p> : (
          <div className="scanner"><video ref={video} muted playsInline /><span className="scanner-frame" aria-hidden="true" /></div>
        )}
        <p className="subtle">Apuntá al QR de la etiqueta. La prenda se suma sola al carrito.</p>
      </div>
    </Sheet>
  )
}
