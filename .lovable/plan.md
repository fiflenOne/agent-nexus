
## Cieľ
Pridať možnosť meniť veľkosť plávajúceho okna s `MonadBrain_AudioBars_Gradient` v pravom dolnom rohu, v rámci jasných min/max hraníc, pričom Three.js scéna (kamera, renderer, composer, bars) sa plynulo prispôsobí.

## Návrh riešenia

### 1) Nový komponent `FloatingResizableWindow`
Súbor: `src/components/monad/FloatingResizableWindow.tsx`

- Stavy: `width`, `height` (v px).
- Hranice: `minW=260`, `minH=180`, `maxW=720`, `maxH=520` (zároveň clampované na `window.innerWidth - 32` / `innerHeight - 32`, aby okno neutieklo mimo viewport pri malých displejoch — relevantné pre aktuálny 485×778 viewport).
- Pozícia: zostáva ukotvené v `bottom-4 right-4` (rast doľava/hore pri ťahaní úchytu).
- Persistencia veľkosti v `localStorage` pod kľúčom `monad.floating.size`.
- Glass štýl ostáva (`rounded-xl border border-white/10 bg-black/50 backdrop-blur-md shadow-2xl shadow-cyan-500/10`).

### 2) Resize handle
- Úchyt v **ľavom hornom rohu** (keďže okno je ukotvené vpravo dole) — vizuálne diagonálne „grip" ikonky (3 šikmé čiarky) s `cursor-nwse-resize`, plocha ~16×16, polopriehľadná, hover zvýrazní.
- Implementácia cez `pointerdown` → `setPointerCapture` → `pointermove`:
  - `newW = startW + (startX - e.clientX)`
  - `newH = startH + (startY - e.clientY)`
  - clamp na [min, max].
- `pointerup` ukončí, uloží do `localStorage`.
- Počas ťahania `user-select: none` a `touch-action: none` na úchyte.

### 3) Udržanie layoutu vizualizéra
`MonadBrain_AudioBars_Gradient` už používa `ResizeObserver` na kontajner a volá `renderer.setSize`, `composer.setSize`, `camera.aspect` update — to znamená, že žiadne zmeny v ňom **nie sú potrebné**. Stačí, že nový wrapper mení `width`/`height` cez inline style, a `ResizeObserver` vo vizualizéri si zmenu zachytí.

Overím však dve veci pri implementácii:
- Bars sú v pevnom polomere 8.7 a kamera má `z=20`. Pri veľmi širokom okne môže vzniknúť prázdne miesto po stranách. To je akceptovateľné (kruh ostane vycentrovaný) — layout sa „udrží", nie roztiahne deformovane.
- Throttle nie je nutný, `ResizeObserver` + `requestAnimationFrame` v `tick` sú dostatočne lacné, ale `composer.setSize` pri každom pohybe je OK (Three to zvláda).

### 4) Integrácia v `src/routes/__root.tsx`
Nahradiť aktuálny statický `<div className="absolute bottom-4 right-4 w-[340px] h-[240px] ...">` za `<FloatingResizableWindow>` so `<MonadBrain_AudioBars_Gradient />` ako children. Žiadne ďalšie zmeny v root.

## Súbory
- **Nový**: `src/components/monad/FloatingResizableWindow.tsx`
- **Upravený**: `src/routes/__root.tsx` (1 import + záměna 1 divu)
- **Bez zmeny**: `MonadBrain_AudioBars_Gradient.tsx` (ResizeObserver už pokrýva responzívnosť)

## Akceptačné kritériá
- Úchyt v ľavom hornom rohu okna umožňuje plynulý resize myšou aj dotykom.
- Veľkosť je clampovaná do [260×180, 720×520] a do viewportu.
- Vizualizér (FFT bars, bloom) sa škáluje bez deformácie, kruh ostáva vycentrovaný.
- Veľkosť prežije reload (localStorage).
- Okno ostáva ukotvené v pravom dolnom rohu.
