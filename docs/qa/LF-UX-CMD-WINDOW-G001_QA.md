# LF-UX-CMD-WINDOW-G001 — Ventanas horizontales de parámetros

**Fecha:** 2026-10-24  
**Baseline:** `LevelForge_INPUT_MOUSE_G001_SOURCE_BASELINE.zip`  
**Estado:** IMPLEMENTADO · PENDIENTE DE QA VISUAL LOCAL

## 1. Alcance

Ampliar las ventanas de parámetros de los comandos del Event Editor sin tocar sus comandos, sus valores ni el intérprete. No confundir con el selector «Insertar comando», que conserva su propio tamaño y será revisado en otro Gate.

## 2. Contrato visual y comportamiento

- Ventana de parámetros común: **860 px de ancho inicial**; el comando **Script: 960 px**.
- Altura **automática según los parámetros visibles** (`AppWindow.height = 0`), sin crear ventanas altas para comandos breves; mínimo de redimensionado: 160 px.
- Dos columnas en un espacio amplio: etiquetas (aprox. 135–165 px) y controles que usan el espacio restante. Campos de código, rutas y listas complejas conservan sus diseños especiales.
- En contenedores menores o iguales a 590 px, el formulario coloca las etiquetas encima de los controles.
- La ventana se limita al espacio disponible del editor; si el contenido no cabe verticalmente se desplaza **dentro de la ventana**, manteniendo encabezado y botones de Confirmar/Cancelar accesibles.
- El editor continúa permitiendo mover, maximizar y redimensionar la ventana mediante `AppWindow` existente.
- No cambia el selector de comandos, no hay código nuevo de ejecución ni modificaciones en `COMMANDS` o `ParamForm` reutilizado por Database/Inspector.

## 3. Pruebas automatizadas ejecutadas

Comando: `node --test scripts/test-db-contract.mjs`

**Resultado observado:** 329 PASS · 0 FAIL · 0 TODO (322 previas + 7 de CMD-WIN).

`test-cmd-window.mjs` cubre: tamaño inicial, altura automática y scroll vertical, columnas, regla responsiva, preservación del selector, botones/vista previa y parámetros declarativos.

**Alcance de evidencia:** contrato de fuente y pruebas Node. **No demuestra renderizado visual en Vue/Electron**.

`npm run build` en este entorno: **NO VERIFICADO** (`sh: vite: not found`; faltan dependencias instaladas).

## 4. QA local obligatorio

| ID | Paso en editor / Player | Resultado exigido |
|---|---|---|
| CMD-01 | Abrir Event Editor → insertar «Mostrar texto» | Ventana horizontal ancha, sin controles comprimidos |
| CMD-02 | Capturar comparación con ventana antigua | Mayor anchura y altura acorde al contenido |
| CMD-03 | Editar «Quién habla» y texto largo | Sin recorte de campos; escritura/edición conservada |
| CMD-04 | Comando corto (Auto-interruptor, interruptor) | No se abre ventana vertical gigante |
| CMD-05 | Comando Script | Más anchura para código; edición normal |
| CMD-06 | Comando con muchas opciones/listas | Scroll interno vertical y footer disponible |
| CMD-07 | Reducir resolución o estrechar ventana (<590 px de contenido) | Etiquetas pasan arriba; controles utilizables, sin scroll horizontal |
| CMD-08 | Maximizar y restaurar | Geometría correcta y formulario responde al nuevo ancho |
| CMD-09 | Abrir «Vista previa» de Mostrar texto | Se abre/termina sin perder valores del formulario |
| CMD-10 | Cancelar y luego aceptar en comandos separados | Cancelar no cambia contenido; Aceptar sí |
| CMD-11 | Editar comandos dentro de ramas anidadas | Se conserva la estructura y la selección actual |
| CMD-12 | Enter / Espacio / doble clic desde lista de comandos | Abren el mismo editor y mantienen controles de foco |
| CMD-13 | Abrir el selector «Insertar comando» | Sigue siendo la ventana existente, no afectada |
| CMD-14 | Compilar con `npm run build` y abrir el editor instalado | Sin errores de Vue/Vite y resultado visual correcto |

## 5. Restricciones

- **No** modifica `AppWindow.vue`, `ParamForm.vue` ni definiciones de comandos: limita el ajuste a la ventana de parámetros en `EventEditor.vue`.
- Conserva `Script`, `RouteEditor`, formularios anidados, vista previa, Enter y Espacio.
- Mantiene comentarios breves, en español y únicamente donde aportan contexto.
- No iniciar `Shift+A`, fuentes UI, recursos UI de sistema, `Match`, F12 o seguridad del proyecto en este Gate.

## 6. Estado de aceptación

- [X] Implementación de geometría y reglas responsivas.
- [X] 329 tests Node PASS.
- [X] `node --check scripts/test-cmd-window.mjs` PASS.
- [ ] Compilación Vue/Vite en máquina con dependencias.
- [ ] Revisión visual / manual CMD-01..14.
- [ ] Aprobación del usuario.

**El Gate no está aprobado visualmente.**
