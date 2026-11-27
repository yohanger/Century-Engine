# LF-EDITOR-VIEWBAR-NAV-DEVICE-CORR-G001 — Implementación

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · COMPILACIÓN/QA LOCAL NO VERIFICADOS · NO CERRADO.
**SOURCE_BASELINE:** `LevelForge_RUNTIME_JOLT_PLAY_START_CORR_G001_SOURCE_BASELINE.zip` (revisión acumulada con corrección Jolt pendiente de QA WASM real).
**Autoridad:** `LF-EDITOR-VIEWBAR-UX-CA-002` (CA-001 SUPERSEDIDA).
**Autorización:** `Listo. LF-EDITOR-VIEWBAR-NAV-DEVICE-CORR-G001 autoriza comenzar`.

## Auditoría

**OBSERVADO:** `Icon.vue` ya contenía iconos `mouse` y `trackpad`. `commands.js` ya registraba `nav.mouse` y `nav.trackpad`; `store.prefs.navigation` (persistencia `levelforge:prefs`), `PreferencesModal.vue`, watcher de `editor/keys.js` y `Viewport.setNavigation` ya realizaban el cambio funcional. No existía un control de ratón/trackpad comentado en `ViewBar.vue`: el contrato G001 anterior lo había retirado de esta ubicación.

**CAUSA RAÍZ del problema UX:** el Gate CA-001 había introducido erróneamente un selector de *calidad de render* con etiquetas PC/Portátil, en lugar del control solicitado de *dispositivo de navegación*. El motor de render y la navegación existentes no tenían una incidencia funcional demostrada por ese requisito.

## Modificaciones

- `src/components/ViewBar.vue`: elimina por completo los imports, etiquetas, campo `<select>` y estilos del selector erróneo de render. Inserta en Escena un único botón de icono (`Icon mouse / trackpad`) que llama al comando `nav.trackpad` o `nav.mouse` según `p.navigation`; añade tooltip, etiqueta accesible y `aria-pressed` dependientes del modo. Sin texto visible, nuevos estados ni gestores.
- `scripts/test-editor-viewbar-ux-g001.mjs`: actualiza VIEWBAR-02 y VIEWBAR-07 conforme a CA-002, preservando las restricciones sobre FOV, gizmos y Edit Mesh.
- `scripts/test-editor-viewbar-render-selector-corr-g001.mjs`: mantiene los diez identificadores VR históricos como aserciones de no-regresión del menú Ver y ausencia del selector incorrecto en ViewBar, conforme a CA-002.
- `scripts/test-editor-editmode-ux-s02-g002.mjs`: permite el único icono de navegación editorial y mantiene las prohibiciones restantes.
- `scripts/test-editor-viewbar-nav-device-corr-g001.mjs`: añade verificaciones específicas para el nuevo contrato.
- `package.json`: añade runner reproducible de regresión.
- Documentación: CA-001 se marca SUPERSEDIDA sin borrar su contenido; CA-002, manual web, implementación y QA nuevos, y ledger de seis hojas.

**Intactos:** `Icon.vue`, `commands.js`, `PreferencesModal.vue`, `store.prefs`, `editor/keys.js`, `viewport.js`, renderer, Player, Jolt, tornado, agua, clima y escenas.

La compilación Vite y la ejecución visual/gestual en Linux/Windows quedan **NO VERIFICADAS** sin acceso a dependencias de compilación ni dispositivos de entrada locales. El estado de QA WASM del Gate Jolt sigue reflejándose aparte; no se declara corregido por esta UI.
