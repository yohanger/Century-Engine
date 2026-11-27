# QA — Alineación de Preferencias

Estado: implementado en fuentes; pendiente de QA integrado, aprobación y cierre.

| Verificación | Resultado |
|---|---|
| Focal Node antes | 1/4 PASS, 3 FAIL |
| Focal Node después | 4/4 PASS |
| Undo/Redo, sensibilidad y estructura de preferencias | 17/17 PASS |
| Chromium, CSS aislado, ancho 760 px | Iconos y textos alineados; columnas comunes; sin overflow |
| Chromium, barra lateral de 136 px (estrés aislado) | Texto multilínea, columnas comunes; sin overflow |
| Chromium, ancho 340 px | Distribución compacta existente, alineación local, sin overflow |
| Electron focal | Bloqueado antes de iniciar (Vite ausente), 0/12 comprobaciones ejecutadas |
| Electron regresión | Bloqueado antes de iniciar (Vite ausente) |
| TOML | Bloqueado por ausencia de smol-toml |
| Build | Bloqueado por ausencia de Vite |

Las capturas `layout-before.png`, `layout-after.png` y variantes `340` son evidencia de una reproducción CSS aislada con Chromium, usando reglas de estilos originales y etiquetas/iconos del código. Los controles interiores son representaciones simplificadas para aislar la distribución. No son capturas del Editor real. La prueba Electron monta PreferencesModal real, verifica las cinco categorías, los encabezados de todas las categorías pertinentes, estados de selección, plegado y adaptación. El modo compacto conserva la disposición horizontal de categorías con saltos de línea, no fuerza columnas de una barra lateral inexistente.

Evidencia previa comunicada por el usuario: Pointer Capture 5/5 Node y 32 comprobaciones Electron; Docking DOM 4/4 Node y 10 comprobaciones Electron; precisión 49/49 Node y 14 comprobaciones Electron; build Editor y Runtime exitosos. Registro íntegro adjunto en evidencia y nuevas filas del ledger, sin cambiar aprobaciones ni confundir esa compilación con la nueva corrección.

## Comandos locales

- `npm run test:suite -- preferences-section-alignment`
- `npm run test:suite -- preferences-section-alignment-electron`
- `npm run test:suite -- undo-context-and-mouse-sensitivity`
- `npm run test:suite -- editor-mouse-sensitivity-config`
- `npm run test:suite -- undo-context-and-mouse-sensitivity-electron`
- `npm run build`

Reproducción aislada opcional: `python <evidence>/layout-browser.py <raíz-de-fuentes> <ZIP-base-anterior> <directorio-de-salida>`, con Playwright y Chromium ya disponibles en el entorno de QA. No son dependencias del producto.
