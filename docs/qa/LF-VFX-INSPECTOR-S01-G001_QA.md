# QA — LF-VFX-INSPECTOR-S01-G001

**Estado:** IMPLEMENTADO · TEST NODE PASS · HARNESS VUE/WEBGL NO VERIFICADO · COMPILACIÓN NO VERIFICADA · QA LOCAL PENDIENTE · NO CERRADO.

## Pruebas

- `scripts/test-vfx-inspector-s01-g001.mjs`: 23 pruebas nuevas que ejecutan el script real de `VfxEditor.vue` con host Vue/preview controlado y comprueban apertura, categorías, edición, Undo/Redo/commit, texturas, preview opt-in, ciclo de vida, herencia `tornadoFlow` y no duplicación de estado.
- `scripts/test-vfx-editor-s03-g001.mjs`: 8/8 PASS, mantiene operadores de curvas y sesión real de preview probada con dobles WebGL.
- `scripts/test-weather-tornado-world-s12-g001.mjs`: 44/44 PASS; S12 continúa comprobando `movement.tornadoFlow` del esquema, y su aserción de UI fue adaptada al Amendment CA-001 (el checkbox meteorológico deja de mostrarse en el recurso). Ninguna otra regla física S12 se retiró.
- `npm run test:vfx-inspector`: **232 PASS, 0 FAIL, 0 SKIP** sobre VFX, Inspector de recursos, Assets, S12 y S12A. Ejecución de Node, no verificación Vue real.
- `scripts/fixtures/vfx/s03/ui.html` y `scripts/test-vfx-ui-s03-g001.mjs`: harness de UI real reutilizado y actualizado para selección en Inspector, Undo/Redo, tres curvas, preview opt-in, vista/restauración y cierre; **Intentado; **NO VERIFICADO** por falta del ejecutable Vite (`Falta Vite: ejecutar npm ci`).
- Regresiones Inspector `test-resource-inspector-g001/2/3`: adaptadas solo para permitir la selección VFX sin alterar otros recursos. No se borra cobertura anterior.
- Tests de paquete `test-vfx-resource-s01-g001.mjs` y Player `test-vfx-player-s02-g002.mjs` fallaron al cargar por **dependencias ausentes** (`jszip`, `@vue/reactivity`); no son fallos funcionales comprobados ni pruebas PASS.
- El test histórico `HC-15` de `test-resource-history-corr-g001.mjs` presenta un fallo independiente: su fixture compara todos los campos JSON, pero el historial restaurado normaliza otros campos que ya no constaban en la fixture. Archivo de producción `history.js` no fue modificado; **NO CORREGIDO EN ESTE GATE**. Requiere auditoría específica si persiste localmente.

## QA local obligatorio

1. Seleccionar un `.vfx` con clic simple en Assets; debe abrirse en Inspector. Doble clic no crea ventana. Probar otro recurso, Inspector de escena y panel Terrain.
2. Cambiar emisión, nacimiento, movimiento, apariencia y curvas. Asignar textura con arrastrar/soltar desde Assets y con dropdown. Modificar y usar Undo/Redo; guardar y reabrir debe conservar exactamente IDs y valores del recurso, sin instancias extras.
3. Confirmar que no aparece el control «Vórtice meteorológico» en `.vfx`; abrir un proyecto S12/S12A anterior debe conservar `movement.tornadoFlow` sin reescribirlo.
4. Seleccionar sin pulsar preview: cámara/escena **no** cambian. Pulsar Vista previa, pausar, avanzar, reiniciar y cerrar. Verificar restauración de cámara/gizmos; repetir seleccionando otro `.vfx`, cambiando escena/pestaña, entrando en Play y saliendo del Editor.
5. Usar panel estrecho con cinco categorías, números y tres editores de curvas sin desbordamiento ni controles inaccesibles. Probar teclado y foco.
6. Verificar VFX3D en Editor y Player exportado, dos instancias del mismo recurso con simulaciones independientes; comprobar que Editor no genera partículas editoriales permanentes.
7. Ejecutar `npm run test:vfx-inspector`, `npm run test:vfx-inspector:ui`, `npm run build`, `npm run electron`. El segundo runner requiere Chromium/Vite y se debe declarar como NO VERIFICADO si no se ejecuta.

**Evidencia a devolver:** logs de los runners y build; capturas del Inspector y recursos; video de la preview abierta/cerrada y retorno de cámara; QA de Player y compatibilidad del legado. No declarar PASS visual ni cierre a partir de una prueba Node con mocks.

## Bloqueadores observados en la instalación de pruebas

`npm run build`: termina con `vite: not found` (dependencias ausentes, compilación **NO VERIFICADA**). `test-vfx-resource-s01-g001.mjs` no puede cargar `jszip`; `test-vfx-player-s02-g002.mjs` no puede cargar `@vue/reactivity`. Estos casos no se incluyen en los 232 PASS y deben ejecutarse en el entorno local tras `npm ci`. La regresión histórica `HC-15` registra una diferencia de fixture JSON ajena al cambio VFX: `history.js` no fue tocado; diagnóstico separado pendiente.
