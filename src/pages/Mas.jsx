import { Link } from 'react-router-dom'
import { Receipt, BarChart3, Wallet, Store, Settings, ChevronRight, Shirt, PackagePlus, TrendingUp, QrCode, Undo2, ClipboardCheck } from 'lucide-react'
import { Page } from '../layout'

const ITEMS = [
  { to: '/ventas', icon: Receipt, t: 'Ventas', d: 'Historial, comprobantes, cambios, devoluciones y anulaciones' },
  { to: '/ventas/devoluciones', icon: Undo2, t: 'Devoluciones y anulaciones', d: 'Qué volvió, por qué motivo y a dónde fue la plata' },
  { to: '/caja', icon: Wallet, t: 'Caja y gastos', d: 'Lo que entró hoy, gastos y cierre de caja' },
  { to: '/reportes', icon: BarChart3, t: 'Reportes', d: 'Ganancia neta, más vendidas, talles y canales' },
  { to: '/catalogo', icon: Store, t: 'Catálogo', d: 'Compartí lo disponible por WhatsApp o Instagram' },
  { to: '/stock', icon: Shirt, t: 'Stock', d: 'Prendas, talles, colores, reposición y prendas quietas' },
  { to: '/stock/ingreso', icon: PackagePlus, t: 'Entró mercadería', d: 'Sumá stock por talle, actualizá el costo y anotá el gasto' },
  { to: '/stock/ajuste', icon: ClipboardCheck, t: 'Ajustar stock', d: 'Fallas, pérdidas y conteos, con motivo' },
  { to: '/stock/precios', icon: TrendingUp, t: 'Actualizar precios', d: 'Subí o bajá precios en bloque, con redondeo' },
  { to: '/stock/etiquetas', icon: QrCode, t: 'Etiquetas con QR', d: 'Imprimí etiquetas para vender escaneando' },
  { to: '/ajustes', icon: Settings, t: 'Ajustes y backup', d: 'Datos de la tienda, descuentos y copia de seguridad' },
]

export default function Mas() {
  return (
    <Page title="Más">
      <div className="list">
        {ITEMS.map(({ to, icon: Icon, t, d }) => (
          <Link key={to} to={to} className="list-item" style={{ padding: '16px 14px' }}>
            <span className="avatar" style={{ borderRadius: 12 }}><Icon size={20} /></span>
            <span className="grow"><span className="title">{t}</span><br /><span className="subtle">{d}</span></span>
            <ChevronRight className="chev" />
          </Link>
        ))}
      </div>
    </Page>
  )
}
