import { NavLink, useNavigate } from 'react-router-dom'
import { ArrowLeft, Home, ShoppingBag, Shirt, Users, LayoutGrid, Receipt, BarChart3, Wallet, Store, Settings, Eye, EyeOff, PackagePlus } from 'lucide-react'
import { setConfig } from './db'
import { useConfig } from './store'

export function Wordmark({ small }) {
  return <span className="wordmark">Auténticas{small && <small>gestión</small>}</span>
}

const navCls = ({ isActive }) => `navlink ${isActive ? 'active' : ''}`
const railCls = ({ isActive }) => `rail-link ${isActive ? 'active' : ''}`

export function Shell({ children }) {
  return (
    <div className="shell">
      <aside className="siderail" aria-label="Navegación principal">
        <Wordmark />
        <NavLink to="/vender" className="rail-link rail-sell"><ShoppingBag /> Nueva venta</NavLink>
        <NavLink to="/" end className={railCls}><Home /> Inicio</NavLink>
        <NavLink to="/ventas" className={railCls}><Receipt /> Ventas</NavLink>
        <NavLink to="/stock" end className={railCls}><Shirt /> Stock</NavLink>
        <NavLink to="/stock/ingreso" className={railCls}><PackagePlus /> Entró mercadería</NavLink>
        <NavLink to="/clientas" className={railCls}><Users /> Clientas</NavLink>
        <NavLink to="/caja" className={railCls}><Wallet /> Caja y gastos</NavLink>
        <NavLink to="/reportes" className={railCls}><BarChart3 /> Reportes</NavLink>
        <NavLink to="/catalogo" className={railCls}><Store /> Catálogo</NavLink>
        <NavLink to="/ajustes" className={railCls}><Settings /> Ajustes y backup</NavLink>
        <p className="rail-foot">Los datos se guardan en este dispositivo.</p>
      </aside>
      <div className="col">{children}</div>
      <nav className="bottomnav" aria-label="Navegación principal">
        <NavLink to="/" end className={navCls}><Home />Inicio</NavLink>
        <NavLink to="/stock" className={navCls}><Shirt />Stock</NavLink>
        <NavLink to="/vender" className={({ isActive }) => `navlink sell ${isActive ? 'active' : ''}`} aria-label="Vender">
          <span className="sell-disc"><ShoppingBag /></span>Vender
        </NavLink>
        <NavLink to="/clientas" className={navCls}><Users />Clientas</NavLink>
        <NavLink to="/mas" className={navCls}><LayoutGrid />Más</NavLink>
      </nav>
    </div>
  )
}

/** Ojo en la barra: oculta / muestra los montos en toda la app. */
function DiscretoBtn() {
  const cfg = useConfig()
  if (!cfg) return null
  const on = !!cfg.discreto
  return (
    <button className="icon-btn" onClick={() => setConfig({ discreto: !on })} aria-pressed={on}
      aria-label={on ? 'Mostrar montos' : 'Ocultar montos'} title={on ? 'Mostrar montos' : 'Ocultar montos'}>
      {on ? <EyeOff /> : <Eye />}
    </button>
  )
}

export function Page({ title, back, actions, home = false, children, wide = false }) {
  const nav = useNavigate()
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          {back && (
            <button className="icon-btn" onClick={() => (window.history.length > 1 ? nav(-1) : nav(back))} aria-label="Volver">
              <ArrowLeft />
            </button>
          )}
          {home ? <><Wordmark small /><h1 className="sr-only">{title}</h1><span className="grow" /></> : <h1>{title}</h1>}
          {actions}
          <DiscretoBtn />
        </div>
      </header>
      <main className="main" style={wide ? { maxWidth: 1240 } : undefined}>{children}</main>
    </>
  )
}
