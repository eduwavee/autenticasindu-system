# Design — Auténticas · Gestión

World: the boutique back-room. Two objects carry the identity: the **hang tag** (etiqueta colgante: clipped top corners, eyelet, string) as the container for products, today's cash and receipts, and the **perchero** (rack: a rose rail with one hanger per size) as the stock and size-picker display. Mode: Operate — standard controls, the world lives in type, palette, density and those two moves.

## Tokens (src/styles.css :root)
- Shell / primary: `--rose-700 #a8235a` (top bar, side rail, primary buttons, active nav); hover `--rose-800 #8a1a49`; deep text-on-pink `--rose-900 #6b1238`; toast/cart bar `--rose-950 #4a0c27`.
- Pink layers: `--rose-500 #dd4d88` (chart bars), `--rose-300 #f3a6c6` (illustrations, strings), `--rose-200 #f8cfe0`, `--rose-100 #fce6ef` (soft buttons, chips), `--rose-50 #fff3f8`.
- Ground `#fffafc`, surface `#fff`, ink `#2b1320`, secondary ink `#6f4a5c`, muted `#8f6c7c`, lines `#f1d9e4` / `#e7c3d3`.
- Status: ok `#17794f`/`#e5f5ed`, warn `#9a5b00`/`#fff2d9`, bad `#b3261e`/`#fde8e6` — always with a text label.
- Type: Figtree Variable (self-hosted via @fontsource), one family, tabular numerals for money. Scale 12 / 13 / 15 / 17 / 21 / 26 / 36 px.
- Radii 8 / 12 / 18; shadows plum-tinted, offset + blur. Motion 150–320 ms, `cubic-bezier(0.16,1,0.3,1)`; one signature motion: the chosen hanger swings.

## Components
- `Tag` (ui.jsx): `.tag > .tag-eyelet + .tag-face`; `rose` variant for headline money; optional `string`. Default face padding 36/16/16.
- `Rack` (ui.jsx): rail + hangers; states in-stock (tinted fill), low (amber count), out (dashed outline, disabled), selected (filled rose label). `mini` for lists.
- Buttons: primary / soft / ghost / danger / wa; 44 px min height (54 lg). Chips with `aria-pressed`. Segmented control `.seg`. Bottom sheet `Sheet` replaces modals.
- Navigation: mobile bottom bar with raised Vender disc; ≥960 px rose side rail with "Nueva venta" first.
