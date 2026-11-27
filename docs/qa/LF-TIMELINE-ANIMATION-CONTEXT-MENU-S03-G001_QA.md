# QA · LF-TIMELINE-ANIMATION-CONTEXT-MENU-S03-G001

**Autorización exacta recibida:** `Listo. LF-TIMELINE-ANIMATION-CONTEXT-MENU-S03-G001 autoriza comenzar`.

**SOURCE_BASELINE de entrada:** `LevelForge_TIMELINE_ANIMATION_INSPECTOR_S02_G001_SOURCE_BASELINE.zip`, aprobado por el usuario con QA local declarado.

**Resultado técnico actual:** IMPLEMENTADO · TEST AUTOMATIZADO NODE PASS · ELECTRON/BUILDS NO VERIFICADOS · QA LOCAL PENDIENTE. El Gate no está aprobado ni cerrado.

## Auditoría previa: observado, inferido, causa del cambio

- **OBSERVADO:** `TimelinePanel.vue` dibujaba tres botones `◆`, `◉/⊘`, `✕` por pista y `AnimationPanel.vue` dibujaba `◆`, `✕` en cada cabecera. Pistas, claves y eventos se seleccionaban en estado editorial sincronizado con `TemporalResourceInspector.vue` de S02.
- **OBSERVADO:** `ContextMenu.vue` + `MenuList.vue` ya proporcionaban un menú único mediante `store.menu`, recorte a viewport, teclado, acciones habilitadas y aspecto sin capa azul.
- **INFERENCIA:** eliminar los botones de las cabeceras recupera espacio para nombres y evita acciones destructivas accidentales; el clic derecho permite distinguir el elemento objetivo.
- **CAUSA DEL TRABAJO:** acciones incrustadas sin menú contextual correspondiente; no se ha diagnosticado un fallo del runtime ni del formato persistente.

## Alcance implementado

- `src/components/TimelinePanel.vue`: botón de clave, botón de mute y eliminación retirados de cada cabecera. Clic derecho sobre cabecera: añadir clave en cabezal (deshabilitado para física horneada), silenciar/activar, eliminar pista. Clic derecho sobre clave: Inspector, situar cabezal, duplicar, eliminar. Clic derecho sobre el carril: añadir clave en tiempo señalado (no para pistas bake) y las mismas acciones de silenciar/activar o eliminar pista que ofrece la cabecera.
- `src/components/AnimationPanel.vue`: eliminación de los dos botones de cabecera; menú de pista o carril para insertar y eliminar; menú de clave para seleccionar, localizar, duplicar y eliminar; menú de evento para Inspector, editor de comandos existente y eliminar; menú sobre carril de eventos para insertar evento en posición temporal.
- Todos los menús reutilizan `store.menu` y sus iconos del `Icon.vue` real. Los callbacks verifican IDs activos antes de actuar sobre un recurso o elemento potencialmente retirado. Los cambios de datos conservan funciones originales, `commit()`, Deshacer/Rehacer y los watchers de selección de S02.
- Sin nuevo modelo, servicio de menú, lateral de propiedades, serialización ni reemplazo del editor de comandos. El arrastre de claves y eventos, doble clic para insertar y preview permanecen en los componentes originales. El panel estrecho y la posición junto al borde quedan cubiertos por el fixture Electron preparado, NO ejecutado aún.

## Evidencia automatizada

| Comprobación | Estado | Evidencia |
|---|---|---|
| Test Node S03: 10 casos funcionales/contrato | PASS | `docs/qa/evidence/LF-TIMELINE-ANIMATION-CONTEXT-MENU-S03-G001/node-15-pass.log` |
| Regresión Node del contrato S02: 5 casos | PASS | Mismo log (15/15 global) |
| Fixture Electron embebido: 50 verificaciones | PREPARADO, NO EJECUTADO | `scripts/fixtures/editor/temporal-context-menu-s03-g001.html` |
| Intento de ejecutar test Electron | BLOQUEADO POR ENTORNO: falta Vite | `docs/qa/evidence/LF-TIMELINE-ANIMATION-CONTEXT-MENU-S03-G001/electron-blocked.log` |
| Build Editor / build Player | NO VERIFICADO, falta Vite | No se afirma compilación PASS |
| `npm run docs:check` | BLOQUEADO POR ENTORNO: falta `marked` | La verificación parcial de referencia pasó; el proceso completo NO PASS |
| QA visual local del usuario | PENDIENTE | La declaración del usuario es la autoridad para QA local |

**Importante:** el test Node ejercita las funciones de menú con dobles de los servicios dependientes; no demuestra que Vue renderice el menú en Electron. No extrapolar 15/15 PASS a QA visual.

## Instalación y QA local (Linux)

Extraer el ZIP completo `LevelForge_TIMELINE_ANIMATION_CONTEXT_MENU_S03_G001_SOURCE_BASELINE.zip` en una carpeta nueva:

`~/Desktop/LevelForge_TIMELINE_ANIMATION_CONTEXT_MENU_S03_G001_SOURCE_BASELINE/`

No extraer sobre S02 aprobado; conservar ese ZIP como rollback. Desde la raíz nueva:

```bash
npm ci
node --test scripts/test-temporal-context-menu-s03-g001.mjs scripts/test-temporal-inspector-s02-g001.mjs
node --test scripts/test-temporal-context-menu-s03-g001-electron.mjs
node --test scripts/test-temporal-inspector-s02-g001-electron.mjs
npm run docs:check
npm run build
npm run electron
```

**Resultados esperados por contrato (no se afirma que hayan pasado localmente):** 15/15 Node focales y regresión S02; 50 verificaciones del fixture Electron S03; 27+ de S02 Electron; compilación Editor y Player sin errores. Un `npm ci` fallido bloquea las comprobaciones que dependen de Vite/Electron.

## Lista de comprobación visual y funcional

1. Abrir cinemática desde Assets. Clic derecho en cabecera de pista: menú coherente, sin botones `◆`, `◉/⊘`, `✕` superpuestos y sin fondo azul. El nombre de pista debe ser legible. Probar click sobre el campo del nombre, renombrado y la selección contextual del Inspector.
2. Activar/silenciar pista desde menú y probar Deshacer/Rehacer. Confirmar que cambia el preview cuando corresponde. Eliminar una pista, Deshacer, rehacer y conservar recursos vecinos.
3. Clic derecho sobre un rombo: deben aparecer las acciones de la **clave** (no el menú de carril ni el de pista); duplicar y eliminar con Deshacer/Rehacer. Clic izquierdo y arrastre permanecen operativos; doble clic en carril añade clave en tiempo apropiado.
4. Clic derecho en espacio vacío de una pista; añadir clave en la posición indicada por el puntero, usando snap. En física horneada el menú no debe permitir claves manuales; la pista conserva su lectura y mute.
5. Abrir clip de Animación: cabecera sin botones sueltos, menú de pista y de clave; `K`, grabación, preview, curvas Bézier y valores desde Inspector siguen funcionando. El menú de un evento permite edición de comandos existente y eliminación con historial; sobre carril de eventos se añade un evento.
6. Alternar cinemáticas, clips, escenas y cerrar un recurso tras abrir un menú: ningún callback debe cambiar otro documento ni dejar selección obsoleta. Probar el menú cerca de bordes del viewport: debe mantenerse dentro de la ventana.
7. En Electron embebido, repetir con Inspector de **260 px**, timeline/animación estrechos y anchos, teclado del menú (flechas/Enter/Escape), guardar y reabrir `.lfproj`, preview y Play. Revisar que no aparezca overlay azul ni scroll horizontal no intencional.
8. Probar en el Player exportado del flujo existente y con controlador First Person/Jolt cuando el entorno lo permita. Mantener la incidencia antigua de plantilla sin controlador fuera de este Gate.

**Evidencia a devolver si aparece incidencia:** reproducción exacta, tipo/ID de recurso y elemento, resultado observado, captura o screencast visual y error de consola si existe. Si todo pasa, basta con la declaración explícita de aprobación local del usuario para registrar ese estado.

## Comparación y entrega

La entrega obligatoria incluye exactamente dos ZIP: `CHANGE` con los archivos nuevos/modificados y `SOURCE_BASELINE` completo para el próximo Gate. Se han excluido instalaciones, compilados, cachés y temporales. No se entrega SHA-256 separado ni `.sh` de verificación. El inventario exacto de diferencias se comprueba antes de generar los ZIP; no se sobreescribe ninguna carpeta local del usuario.

## Pendientes externos al Gate

Rediseño integral de la barra, regla, cabezal y legibilidad de pistas; instalación automática de la extensión VS Code (`.vsix`, Flathub/nativo); renombrado que actualiza referencias por nombre; incidencia de plantilla sin controlador. Ninguno está implementado ni autorizado por S03-G001.
