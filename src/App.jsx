import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { Shell } from './layout'
import { useConfig } from './store'
import { CartProvider } from './CartProvider'
import { ToastProvider } from './ui'
import { setDiscreto } from './utils'
import Inicio from './pages/Inicio'
import Vender from './pages/Vender'
import Cobrar from './pages/Cobrar'
import VentaDetalle from './pages/VentaDetalle'
import Ventas from './pages/Ventas'
import Stock from './pages/Stock'
import ProductoForm from './pages/ProductoForm'
import Clientas from './pages/Clientas'
import ClientaDetalle from './pages/ClientaDetalle'
import Mas from './pages/Mas'
import Caja from './pages/Caja'
import Ajustes from './pages/Ajustes'
import Onboarding from './pages/Onboarding'
import Bloqueo from './pages/Bloqueo'

// Pantallas que no se usan en el mostrador: se cargan cuando se entra (la de etiquetas trae la librería de QR).
// El service worker las guarda igual para usar sin internet.
const Etiquetas = lazy(() => import('./pages/Etiquetas'))
const Precios = lazy(() => import('./pages/Precios'))
const Ingreso = lazy(() => import('./pages/Ingreso'))
const Ajuste = lazy(() => import('./pages/Ajuste'))
const Reportes = lazy(() => import('./pages/Reportes'))
const Catalogo = lazy(() => import('./pages/Catalogo'))
const Devoluciones = lazy(() => import('./pages/Devoluciones'))

/** Minutos en segundo plano después de los cuales se vuelve a pedir el PIN. */
const RELOCK_MIN = 5

function useBloqueo(activo) {
  const [bloqueada, setBloqueada] = useState(true)
  const oculta = useRef(0)
  // Crear el PIN desde Ajustes no tiene que bloquear la sesión en curso.
  useEffect(() => {
    const ok = () => setBloqueada(false)
    window.addEventListener('autenticas:desbloquear', ok)
    return () => window.removeEventListener('autenticas:desbloquear', ok)
  }, [])
  useEffect(() => {
    if (!activo) return
    const h = () => {
      if (document.hidden) oculta.current = Date.now()
      else if (oculta.current && Date.now() - oculta.current > RELOCK_MIN * 60000) setBloqueada(true)
    }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [activo])
  return [activo && bloqueada, () => setBloqueada(false)]
}

function Routed() {
  const cfg = useConfig()
  const [bloqueada, desbloquear] = useBloqueo(!!cfg?.pinHash)
  if (!cfg) return null
  if (!cfg.onboarded) return <Onboarding />
  if (bloqueada) return <Bloqueo cfg={cfg} onUnlock={desbloquear} />
  // Al cambiar la configuración se vuelve a dibujar todo el árbol, así los montos se ocultan / muestran
  // sin desmontar las pantallas (no se pierde lo que se estaba cargando).
  setDiscreto(cfg.discreto)
  return (
    <Shell>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/vender" element={<Vender />} />
        <Route path="/vender/cobrar" element={<Cobrar />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/ventas/devoluciones" element={<Devoluciones />} />
        <Route path="/ventas/:id" element={<VentaDetalle />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/stock/nuevo" element={<ProductoForm />} />
        <Route path="/stock/precios" element={<Precios />} />
        <Route path="/stock/ingreso" element={<Ingreso />} />
        <Route path="/stock/ajuste" element={<Ajuste />} />
        <Route path="/stock/etiquetas" element={<Etiquetas />} />
        <Route path="/stock/:id" element={<ProductoForm />} />
        <Route path="/clientas" element={<Clientas />} />
        <Route path="/clientas/:id" element={<ClientaDetalle />} />
        <Route path="/mas" element={<Mas />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Shell>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <CartProvider>
          <Routed />
        </CartProvider>
      </ToastProvider>
    </HashRouter>
  )
}
