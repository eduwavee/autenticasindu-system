# Auténticas · Gestión

Sistema de gestión para **Auténticas** (@autenticas_ind_), tienda de ropa femenina: ventas, caja, stock por talle y color, clientas con fiado, señas y saldo a favor, cambios y devoluciones, gastos, reportes y catálogo para compartir.

Es una **PWA**: se instala en el celular como una app y funciona **100 % sin internet**. No tiene backend: los datos viven en el dispositivo y se respaldan con un archivo de backup.

[![CI y publicación](https://github.com/eduwavee/autenticasindu-system/actions/workflows/ci.yml/badge.svg)](https://github.com/eduwavee/autenticasindu-system/actions/workflows/ci.yml)

**App publicada:** https://eduwavee.github.io/autenticasindu-system/

Hecho por **Sync Solutions** · Eduardo Velazques.

---

## Índice

- [Capturas](#capturas)
- [Qué hace](#qué-hace)
- [Dónde se guardan los datos](#dónde-se-guardan-los-datos)
- [Guía rápida para la tienda](#guía-rápida-para-la-tienda)
- [Desarrollo](#desarrollo)
- [Deploy](#deploy)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Tests](#tests)
- [Limitaciones conocidas](#limitaciones-conocidas)

---

## Capturas

> Tomadas con los datos de ejemplo que trae la app (prendas, clientas y ventas ilustrativas).

### En el celular

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/capturas/01-inicio.png" alt="Inicio" width="200"><br><sub>Inicio</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/02-vender.png" alt="Vender" width="200"><br><sub>Vender</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/03-perchero.png" alt="Elegir talle en el perchero" width="200"><br><sub>Elegir talle en el perchero</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/04-cobrar.png" alt="Cobrar" width="200"><br><sub>Cobrar</sub></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/capturas/05-comprobante.png" alt="Comprobante" width="200"><br><sub>Comprobante</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/06-devolucion.png" alt="Devolución" width="200"><br><sub>Devolución</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/07-stock.png" alt="Stock" width="200"><br><sub>Stock</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/08-precios.png" alt="Precios en bloque" width="200"><br><sub>Precios en bloque</sub></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/capturas/09-ingreso.png" alt="Entró mercadería" width="200"><br><sub>Entró mercadería</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/10-etiquetas.png" alt="Etiquetas con QR" width="200"><br><sub>Etiquetas con QR</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/11-clientas.png" alt="Clientas" width="200"><br><sub>Clientas</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/12-clienta.png" alt="Ficha de clienta" width="200"><br><sub>Ficha de clienta</sub></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/capturas/13-caja.png" alt="Caja y arqueo" width="200"><br><sub>Caja y arqueo</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/14-reportes.png" alt="Reportes" width="200"><br><sub>Reportes</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/15-catalogo.png" alt="Catálogo" width="200"><br><sub>Catálogo</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/16-ajustes.png" alt="Ajustes y backup" width="200"><br><sub>Ajustes y backup</sub></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/capturas/21-carrito.png" alt="Carrito con precio especial e ítem libre" width="200"><br><sub>Carrito: precio especial e ítem libre</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/22-en-espera.png" alt="Ventas en espera" width="200"><br><sub>Ventas en espera</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/19-devoluciones.png" alt="Devoluciones y anulaciones" width="200"><br><sub>Devoluciones y anulaciones</sub></td>
    <td align="center" width="25%"><img src="docs/capturas/20-ajuste.png" alt="Ajustar stock con motivo" width="200"><br><sub>Ajustar stock con motivo</sub></td>
  </tr>
</table>

### En la compu

La misma app se adapta a pantallas grandes con una barra lateral.

<p align="center">
  <img src="docs/capturas/17-escritorio-inicio.png" alt="Inicio en pantalla de escritorio" width="49%">
  <img src="docs/capturas/18-escritorio-vender.png" alt="Vender en pantalla de escritorio" width="49%">
</p>

---

## Qué hace

### Vender
- Catálogo con las prendas como etiquetas colgantes; el talle se elige en un perchero que muestra el stock de cada uno.
- Búsqueda por nombre o por código de etiqueta; escaneo de QR con la cámara (Chrome en Android).
- Carrito, descuento por % o monto fijo, recargo por crédito, pago dividido en varios medios.
- Medios: efectivo, transferencia / Mercado Pago, débito, crédito, a cuenta (fiado), seña y saldo a favor.
- Canal de venta (local, Instagram, WhatsApp), prenda apartada para entregar después, nota.
- Comprobante por WhatsApp.
- Valida el stock antes de registrar: si no alcanza, avisa y no toca nada.

### Carrito del mostrador
Para que toda venta del local pase por la app y la dueña tenga el control de lo que se vende:
- **No se pierde**: si se cierra la app o se recarga a mitad de una venta, el carrito sigue ahí.
- **Ventas en espera**: se pausa una venta (por ejemplo, la clienta está en el probador), se atiende otra y se retoma después. Puede haber varias a la vez, con nombre; también se ven en Inicio.
- **Precio especial por prenda** solo para esa venta: el comprobante muestra el precio de lista tachado y el que se cobró.
- **Ítem libre** para lo que no está en el stock: un arreglo, una bolsa de regalo, una prenda sin cargar.
- **Vaciar** el carrito y **contador** de prendas en el botón Vender.

### Cambios, devoluciones y anulaciones
- **Devolver** prendas sueltas de una venta: el descuento o recargo se prorratea, primero baja lo que la clienta debía y lo ya pagado vuelve como plata (por el medio que elijas) o como saldo a favor.
- **Cambiar** prendas por otras: la devolución y la venta nueva se registran juntas. Si la prenda nueva sale menos, la diferencia se devuelve o queda a favor.
- **Anular** es devolver todo lo que queda. Los cobros originales no se borran: el reintegro se anota el día en que se hace, así las cajas y cierres de días anteriores no cambian.
- **Corregir** una venta sin anularla: clienta, canal, nota, entrega y medio de pago (también se corrige en la caja).
- **Motivo** opcional en cada devolución, cambio o anulación: no le quedó el talle, no le gustó, falla, error al cobrar u otro.
- **Devoluciones y anulaciones** (desde Ventas o Más): todo lo que volvió en el período, cuánto valía, cuánta plata salió de la caja, cuánto quedó a favor, por motivo, qué prendas y talles vuelven más, y el detalle de cada una.

### Stock
- Prendas con foto, categoría, precio, costo y margen; variantes de talle × color con stock propio.
- Filtros: stock bajo, agotadas, **quietas** (sin ventas hace X días) y ocultas. Valor del inventario a costo y a precio de venta.
- **Entró mercadería**: suma stock por talle, actualiza el costo y anota el gasto en un solo paso. Guarda historial de ingresos, y un ingreso se puede **cancelar** (compra devuelta al proveedor o cargada por error): sale del stock y se borra el gasto.
- **Ajustar stock con motivo**: falla, robo o pérdida, uso personal, corrección por conteo. Queda registrado con su costo; los cambios hechos a mano en la ficha de la prenda también quedan registrados.
- **Actualizar precios en bloque**: subir o bajar por %, para todas o por categoría, con redondeo ($100, $500, $1.000) y vista previa. La última actualización se puede deshacer.
- **Etiquetas con QR** para imprimir o guardar en PDF. El QR abre la app y suma la prenda al carrito.

### Clientas
- Ficha con WhatsApp, Instagram, talle habitual, cumpleaños y notas.
- Historial de compras, pagos, señas, devoluciones y cambios.
- Saldo pendiente (fiado) y **saldo a favor**: cargar seña, cobrar deuda (lo que se paga de más queda a favor), usar el saldo para cancelar deuda o devolverlo.
- WhatsApp con un toque: recordatorio de deuda con el alias de transferencia, saludo de cumpleaños y **novedades en su talle** con lo último que entró.
- Filtros: me deben, saldo a favor, cumpleaños próximos, hace rato no compran, mejores clientas.

### Caja y gastos
- Caja del día por medio de pago, con las devoluciones de plata aparte.
- Gastos por categoría (mercadería, alquiler, servicios, envíos, publicidad, sueldos, otros).
- Arqueo de efectivo (fondo + efectivo − gastos en efectivo contra lo contado) y registro de cierres.

### Reportes
- Ganancia neta (ventas − costo de lo vendido − gastos), ganancia bruta y margen, todo neto de devoluciones.
- Comparación con el período anterior (por ejemplo, este mes contra los mismos días del mes pasado).
- Períodos: hoy, 7 días, este mes, mes anterior o un rango de fechas a elección.
- Ventas por día u hora, más vendidas, por medio de pago, categoría, canal y talle.
- Mercadería que salió sin venderse (fallas, pérdidas, uso), valuada a costo y por motivo.
- Prendas quietas y cuánta plata hay invertida en ellas.

### Inicio, catálogo y ajustes
- **Inicio**: vendido hoy, meta diaria, lo que entró por medio de pago, cuánto te deben, stock bajo, cumpleaños cercanos y aviso de backup.
- **Catálogo**: compartir lo disponible por WhatsApp como texto, con fotos (hoja de compartir del celular) o como página web descargable con botón "Pedir por WhatsApp".
- **Ventas**: historial con filtros (con saldo, apartadas, con devoluciones, anuladas) y exportación a CSV para Excel.
- **Ajustes**: datos de la tienda, meta diaria, descuento en efectivo, recargo por crédito, umbrales de stock bajo y prenda quieta, backup, PIN y modo discreto.

### Privacidad en el mostrador
- **Modo discreto**: el ojo de la barra superior oculta todos los montos en pantalla. Los comprobantes y mensajes salen con los montos igual.
- **PIN** opcional: se pide al abrir la app y después de 5 minutos en segundo plano.

---

## Dónde se guardan los datos

Todo se guarda **en el navegador del dispositivo** (IndexedDB). Nada se envía a ningún servidor: el hosting solo sirve los archivos de la app.

Por eso:

| Situación | ¿Se pierden los datos? |
|---|---|
| Se cierra la app, se apaga el celular, no hay internet | No |
| Se actualiza la app a una versión nueva | No (los datos se migran solos) |
| Se pierde, se rompe o se resetea el celular | **Sí**, salvo lo que esté en un backup |
| Se borran los datos del navegador o se desinstala la app | **Sí**, salvo lo que esté en un backup |
| iPhone usándola desde Safari **sin instalar** | Safari puede borrarlos tras días sin uso. **Instalada** no pasa |
| Cambia la dirección web (dominio) de la app | La app arranca vacía en la dirección nueva (se recupera con el backup) |
| Se abre en otro celular u otro navegador | Cada uno tiene sus propios datos, no se sincronizan |

**El backup es la única copia de seguridad.** La app avisa en Inicio si pasaron 7 días sin backup.

---

## Guía rápida para la tienda

1. **Instalar la app**
   - Android: abrir el link en Chrome → menú ⋮ → "Instalar app".
   - iPhone: abrir el link en **Safari** → Compartir → "Agregar a inicio".
   - Usarla siempre desde el ícono, no desde el navegador.
2. **Primer uso**: cargar el nombre y el WhatsApp de la tienda. Se puede probar con datos de ejemplo y después borrarlos desde Ajustes → Zona delicada.
3. **Cargar las prendas**: Stock → "+ Prenda", con talles, colores, stock, precio y costo.
4. **Vender**: botón Vender → tocar la prenda → elegir el talle en el perchero → Cobrar.
5. **Backup una vez por semana**: Ajustes → "Mandar backup" → enviarlo a un chat de WhatsApp propio o guardarlo en Drive.
6. **Recuperar en otro celular**: instalar la app, ir a Ajustes → "Restaurar" y elegir el archivo de backup.

> Si se olvida el PIN no hay forma de recuperarlo: hay que borrar los datos del sitio y restaurar el último backup.

---

## Desarrollo

Requisitos: **Node.js 20 o superior**.

```bash
git clone https://github.com/eduwavee/autenticasindu-system.git
cd autenticasindu-system
npm install
npm run dev        # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run dev -- --host` | Igual, pero accesible desde el celular en la misma red Wi-Fi |
| `npm run build` | Genera `dist/` listo para publicar (PWA con service worker) |
| `npm run preview` | Sirve el build de `dist/` para probarlo |
| `npm test` | Corre los tests de la capa de datos |
| `npm run test:watch` | Tests en modo watch |
| `npm run lint` | Lint con oxlint (los avisos cuentan como error) |

La cámara (escaneo de QR) y la instalación como app necesitan **HTTPS**; en `localhost` funcionan, desde otra IP de la red no.

### Stack

- **React 19** + **Vite 8**, ruteo con **React Router 7** (hash router, para funcionar en cualquier hosting estático).
- **Dexie 4** sobre IndexedDB, con `dexie-react-hooks` para consultas reactivas.
- **vite-plugin-pwa** (Workbox) para el modo offline e instalable.
- **qrcode** para las etiquetas, **lucide-react** para íconos, fuente **Figtree** autoalojada.
- **Vitest** + **fake-indexeddb** para tests; **oxlint** para lint.

---

## Deploy

La app se publica sola en **GitHub Pages**: https://eduwavee.github.io/autenticasindu-system/

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push y pull request: instala, pasa el lint, los tests y el build. Si todo pasa y es la rama `main`, publica `dist/` en GitHub Pages. Si algo falla, no se publica y GitHub avisa.

`npm run build` genera `dist/`, una carpeta 100 % estática, así que también se puede publicar en Netlify, Vercel, Cloudflare Pages o Render.

- Comando de build: `npm run build` · Carpeta a publicar: `dist`.
- Necesita **HTTPS** para instalarse como app (todos los anteriores lo dan).
- `base: './'` en `vite.config.js` permite servirla desde una subcarpeta (por ejemplo GitHub Pages en `/autenticasindu-system/`).

> ⚠️ **Elegir la dirección definitiva antes de que la tienda empiece a cargar datos.** Los datos quedan atados a la dirección exacta; si cambia, hay que pasarlos con un backup.

Cada deploy nuevo actualiza la app sola la próxima vez que se abre con internet (`registerType: 'autoUpdate'`).

---

## Estructura del proyecto

```
.github/workflows/ci.yml  Lint, tests, build y publicación en GitHub Pages
src/
├── main.jsx            Punto de entrada; pide al navegador guardado persistente
├── App.jsx             Rutas, bloqueo con PIN y modo discreto
├── db.js               Esquema Dexie, migraciones y toda la lógica de negocio
│                       (ventas, devoluciones, cambios, saldo a favor, caja, backup)
├── fotos.js            Conversión de fotos Blob ⇄ dataURL (backup y catálogo)
├── textos.js           Textos que salen de la app: comprobante, recordatorios, catálogo
├── utils.js            Formato de montos y fechas, períodos, WhatsApp, imágenes, QR
├── hooks.js            useHoy, useFotoUrl, productos con stock, última venta por prenda
├── store.js            useConfig y contexto del carrito
├── CartProvider.jsx    Carrito: se guarda en el dispositivo, ventas en espera, precio especial, ítem libre
├── ui.jsx              Componentes base: etiqueta, perchero, hoja inferior, toast…
├── layout.jsx          Barra superior, navegación inferior y lateral
├── seed.js             Datos de ejemplo
├── styles.css          Estilos y tokens de diseño
├── pages/              Una pantalla por archivo
└── __tests__/          Tests de la capa de datos
docs/capturas/          Capturas de pantalla del README
```

Documentación de producto y diseño: [`PRODUCT.md`](PRODUCT.md) y [`DESIGN.md`](DESIGN.md).

---

## Modelo de datos

Base IndexedDB `autenticas`, esquema **versión 3** (`src/db.js`).

| Tabla | Contenido |
|---|---|
| `productos` | Prendas: nombre, categoría, precio, costo, foto (Blob), activo |
| `variantes` | Talle × color de cada prenda, con su stock |
| `clientas` | Contacto, talle habitual, cumpleaños (`MM-DD`), notas |
| `ventas` | Ítems, totales, pagos, saldo, lo cobrado después a cuenta, lo devuelto |
| `cobros` | Movimientos de plata con fecha: venta, pago a cuenta, seña y reintegro (negativo) |
| `creditos` | Saldo a favor por clienta: suma al cargar, resta al usar |
| `devoluciones` | Devoluciones, cambios y anulaciones con su fecha, motivo, valor y costo |
| `gastos` | Gastos por categoría y medio de pago |
| `cierres` | Cierres de caja con el arqueo |
| `fondos` | Fondo de caja inicial por día |
| `ingresos` | Historial de entradas de mercadería (con marca si se cancelaron) |
| `ajustes` | Ajustes de stock: prenda, talle, cantidad (+/−), costo, motivo y nota |
| `esperas` | Ventas en espera del mostrador |
| `config` | Ajustes de la tienda (clave → valor) |

Reglas importantes:

- **La caja se arma con `cobros`**: cada movimiento de plata tiene su fecha y nunca se borra. Las devoluciones de plata son cobros negativos con fecha del día en que se hacen.
- **Lo vendido** en un período = ventas del período − devoluciones del período. Las anulaciones hechas antes de la versión 2 no tienen devolución registrada y se excluyen de los reportes.
- Pagar con **saldo a favor** o con el crédito de un **cambio** no genera cobro: no entra plata a la caja.
- Las líneas del carrito con **precio especial** guardan también `precioLista`; los **ítems libres** no tienen variante y no tocan el stock.
- Al abrir la app, la **migración v1 → v2** pasa el fondo de caja a su tabla, reconstruye lo cobrado a cuenta por venta, saca las fotos copiadas dentro de las ventas y convierte las fotos a Blob.

### Formato de backup

```json
{ "app": "autenticas", "version": 3, "exportado": "2026-10-02T14:00:00.000Z", "tablas": { "productos": [], "ventas": [] } }
```

- Las fotos van como dataURL dentro del JSON.
- Restaurar **reemplaza todos los datos** del dispositivo.
- Los backups de versiones anteriores (1 y 2) se migran al restaurar; los de una versión más nueva que la app se rechazan con un aviso para actualizar.

---

## Tests

```bash
npm test
```

Cubren la lógica de `src/db.js` contra una IndexedDB simulada:

- Venta: descuento de stock, rechazo sin stock suficiente (sin cambios parciales), saldo sin clienta.
- Anulación: no borra cobros de días pasados, reintegro con fecha de hoy, lo cobrado a cuenta vuelve como saldo a favor.
- Devoluciones parciales con descuento prorrateado, redondeo exacto en la última devolución.
- Cambios: más caro, más barato (reintegro del excedente) y cambio fallido que deja todo intacto.
- Saldo a favor: pago de más, uso en ventas, compensación de deuda y devolución.
- Corrección de venta, entrada de mercadería, precios en bloque con redondeo.
- Motivos de devolución y anulación, ajustes de stock (sin stock negativo), cancelación de ingresos (y su bloqueo si esas prendas ya se vendieron).
- Ítems libres y precio especial en el carrito.
- Backup de ida y vuelta, rechazo de versiones nuevas, migración de backups v1 y de una base v1 instalada.

Además de los tests, cada pantalla se probó de punta a punta en Chrome (tamaño celular y escritorio) con los datos de ejemplo.

---

## Limitaciones conocidas

- **Un solo dispositivo.** Sin backend no hay sincronización entre celulares ni copia en la nube automática. Usarla en varios dispositivos a la vez requeriría un backend (siguiente etapa posible).
- **El backup depende de la usuaria.** La app lo recuerda cada 7 días, pero no puede hacerlo sola.
- **El PIN es una traba para curiosos, no un cifrado**: los datos no se encriptan en el dispositivo.
- **El escáner de QR dentro de la app funciona en Chrome Android.** En iPhone el QR se lee con la cámara del sistema y abre el link en Safari.
- Las ventas en espera no reservan stock: al retomarlas se vuelve a controlar.
- Las etiquetas QR llevan la dirección desde donde se imprimen: hay que imprimirlas desde la app publicada (la app avisa si estás en una dirección local).
