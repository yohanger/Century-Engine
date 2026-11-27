# LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_CORR-001 · Corrección del QA Electron

**Autorización literal:** «Listo. LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_CORR-001 autoriza comenzar» (2026-11-08).

## Observado

- El usuario instaló dependencias con `npm ci` y obtuvo 17/17 PASS del test Node original.
- El runner Electron falló antes de cualquier comprobación del Inspector: `readyState:"complete"`, `stage:null`, `checks:null`.
- La fixture `scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html` contiene dos bloques JavaScript; el inicial clásico tenía un paréntesis de cierre omitido en el listener `unhandledrejection`.
- `TERR-FOLD-17` comprobaba sintaxis del runner y del módulo, pero ignoraba el bloque clásico. La versión original de ese bloque falla en `node --input-type=commonjs --check` con `SyntaxError: missing ) after argument list`.

## Causa raíz

Un error de sintaxis en el script clásico impide registrar `window.__lfTerrainFoldQA` y publicar el estado. El runner espera el resultado que nunca se produce. Es un defecto de fixture/validación; no demuestra defecto de `TerrainPanel.vue`.

## Cambio indispensable

1. Añadir el `)` omitido al manejador `unhandledrejection` sin alterar ninguna de las 37 comprobaciones de la fixture.
2. Extender `TERR-FOLD-17` para enumerar exactamente los dos `<script>` existentes y comprobar sintaxis de **ambos**, en modo `commonjs` y `module` respectivamente.
3. Añadir `TERR-FOLD-18`, regresión negativa: reintroducir en memoria el defecto y exigir rechazo sintáctico. Añadir `TERR-FOLD-19`: conservar 37 checks, reporting y contrato `minChecks` del runner.
4. Registrar pruebas reales, límites de entorno y condición de QA local en las seis hojas del ledger.

## Fuera de alcance

No se modificaron `src/components/TerrainPanel.vue`, `InspectorDock.vue`, `Inspector.vue`, el modelo, runtime Terrain, World, Jolt, Player, Assets, operaciones de usuario ni la infraestructura global de tooltips. No se alteraron los scripts del runner Electron.

## Autoridad y estados

UX-01..UX-08 y G005-G001 continúan vigentes. Esta CORR-001 corrige solamente la infraestructura de QA; no autoriza G005-G002 ni presume QA visual. **IMPLEMENTADO; Node PASS; Electron/build NO VERIFICADOS; QA local PENDIENTE; NO APROBADO / NO CERRADO.**
