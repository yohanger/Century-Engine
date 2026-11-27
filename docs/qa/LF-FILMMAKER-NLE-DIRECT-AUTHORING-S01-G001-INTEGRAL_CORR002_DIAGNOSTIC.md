# Nether FilmMaker — S01 CORR-002 · Diagnóstico de arranque y DevTools

**Fecha:** 2026-11-06  
**Gate parent:** `LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL` (aprobado en sintaxis literal)  
**Amendment:** `LF-FILMMAKER-NLE-DIRECT-AUTHORING-CA-001` ratificado  
**Baseline entrada:** `LF_FILMMAKER_NLE_DIRECT_AUTHORING_S01_G001_INTEGRAL_CORR001_SOURCE_BASELINE.zip`  
**Estado:** corrección diagnóstica implementada; **funcionalidad original NO VERIFICADA / QA LOCAL FALLÓ**. No cerrar.

## Hallazgos — OBSERVADO, INFERENCIA, CAUSA RAÍZ

**OBSERVADO (evidencia de usuario en `Texto pegado(20261106-123759).txt`):**
- Ejecutó las pruebas y la compilación desde `~/Desktop/LF_TIMELINE_PRO_UX_S07_G001_CORR001_SOURCE_BASELINE`, no desde `LF_FILMMAKER_NLE_DIRECT_AUTHORING_S01_G001_INTEGRAL_CORR001_SOURCE_BASELINE`.
- La suite S01 CORR-001 indicó 8 PASS, 0 FAIL, y Vite terminó `✓ built in 1m 42s` desde la carpeta S07.
- El usuario reporta que `+ Nodo…` y el Inspector siguen sin responder. Un PASS de tests estáticos o una compilación no constituye QA de interacción.
- En el código real `electron/main.cjs`, el listener F12 se instalaba solo para el Editor (`!film`) o con `DEV_URL`. FilmMaker compilado localmente no recibía F12.
- El SOURCE_BASELINE S01 CORR-001 sí contiene el selector `film-node-chooser` y el host `film-clip-inspector-host`; se conservan en esta entrega.

**INFERENCIA:** mezclar el CHANGE de S01 con un árbol completo S07 puede dejar integraciones distintas entre `FilmApp`, Timeline, sesión y Electron, aunque una prueba que revisa cadenas de código pase. El log por sí solo no demuestra que la mezcla sea la única causa del fallo de UI.

**CAUSA RAÍZ CONFIRMADA DEL BLOQUEO DIAGNÓSTICO:** el condicional de `electron/main.cjs` excluía FilmMaker compilado de la ruta F12. **La causa raíz de que no funcionen los botones sigue SIN VERIFICAR** hasta probar el baseline correcto y leer la consola real de Electron.

## Alcance implementado

- **Un solo archivo original modificado:** `electron/main.cjs`.
- Habilitar `F12` y `Ctrl+Shift+I` para **FilmMaker local sin empaquetar**, tanto desde Vite como desde el frontend compilado. No habilitarlo en el AppImage distribuido.
- Mantener la política de F12 del Editor principal y `Ctrl+R` en Vite.
- No se modifican clips, pistas, nodos, Inspector, `NleTimeline.vue`, `FilmApp.vue`, Player, grabación móvil o `.nfm`.
- Test ejecutable que inyecta `webContents` falso y prueba directamente el controlador `before-input-event` de `electron/main.cjs`, incluyendo F12, teclas alternativas, auto-repeat y modo empaquetado.

## Pruebas de desarrollo

- `node --test scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr002.mjs`: **8 PASS, 0 FAIL**.
- Regresión seleccionada S01/FilmMaker: **152 PASS, 2 SKIP, 0 FAIL**.
- `node --check electron/main.cjs`: PASS.
- Vue/Vite: **NO VERIFICADO** en este entorno sin `node_modules`.
- Electron (F12 real, UI, clic, drag&drop, Inspector): **NO VERIFICADO**, pendiente del usuario.

## QA local correcto — sin mezclar árboles

1. Conserva intacta la carpeta `LF_TIMELINE_PRO_UX_S07_G001_CORR001_SOURCE_BASELINE`. **No extraigas CHANGE CORR-002 sobre S07.**
2. Extrae **únicamente** `LF_FILMMAKER_NLE_DIRECT_AUTHORING_S01_G001_INTEGRAL_CORR002_SOURCE_BASELINE.zip` en **una carpeta nueva independiente**. No combines los dos ZIP en una carpeta.
3. Desde esa nueva raíz (donde está `package.json`), comprueba `pwd` y la existencia de `src/filmmaker/NleTimeline.vue`, `scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr002.mjs` y `electron/main.cjs`.
4. Ejecuta `npm ci` si no está `node_modules`. Ejecuta la prueba `node --test scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr002.mjs` (esperado: 8 PASS).
5. Ejecuta `npm run electron -- --build` para abrir LevelForge, crea un recurso Cinematic y ábrelo en FilmMaker desde el Editor. **No usar únicamente `npm run filmmaker -- --build`** para probar la vinculación nativa por ID, porque ese comando abre FilmMaker directamente sin el contexto de una ventana Editor vinculada.
6. En la ventana de FilmMaker pulsa **F12**, o **Ctrl+Mayús+I**. En DevTools selecciona la pestaña **Console** y activa *Preserve log* si está disponible. Sin cerrar DevTools, haz clic en `+ Nodo…` y selecciona un clip. Copia el **primer error rojo** completo y captura el estado del selector/Inspector.
7. Verifica que puedes añadir una cámara de FilmMaker como plano, un nodo de escena elegible como pista y que el panel Inspector muestra las propiedades del clip. Comprueba guardar/reabrir.
8. Reporta el `pwd` real usado, resultado del primer test, salida final de compilación, mensaje rojo de Console (si existe) y capturas de selector e Inspector. Si F12 no abre, indicarlo; no declarar PASS por el éxito de la compilación.

**Siguiente acción:** analizar la evidencia real; si persiste el fallo en el baseline correcto, corregir su causa raíz en los archivos originales dentro del Gate S01, sin ampliar UX ni crear componentes paralelos.

## Diferencias frente a CORR-001

**Nuevos:** este documento y `scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr002.mjs`.  
**Modificados:** `electron/main.cjs`, `docs/qa/LevelForge_DB_Ledger.xlsx`.  
**Eliminados:** ninguno.  
**No modificar:** cinematics, FilmMaker Mobile, escenas, runtime de grabación, Editor Player, diseños visuales.
