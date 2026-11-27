# LF-VCS-DOCS-G001 — Evidencia y QA documental

**Estado:** IMPLEMENTADO EN FUENTE · TESTS DOCUMENTALES PASS · GENERADOR CANÓNICO Y QA ELECTRON PENDIENTES.

## Baseline y alcance

SOURCE_BASELINE: `LevelForge_EDITOR_SNAP_SHIFT_G001_SOURCE_BASELINE.zip` (1.149 entradas). Solo se modifican fuentes del manual, índice de `scripts/gen-docs-web.mjs`, el `content.js` generado, tests, documentación y ledger. No hay cambios al backend Git ni al Player.

## QA ejecutado en este contenedor

- `node --test scripts/test-vcs-docs-g001.mjs scripts/test-docs-web-g001.mjs`: **21 PASS / 0 FAIL / 0 SKIP**. Cobertura: siete capítulos, enlaces, rutas, nombres UI, operaciones reales, seguridad, búsqueda, offline, fuentes y nodos existentes.
- `node --check scripts/gen-docs-web.mjs` y comprobación sintáctica de los archivos JS nuevos: **PASS**.
- `public/docs/content.js`: contenido estático enlazado en el portal existente con siete capítulos y página `node-vfx` faltante en la salida heredada; pruebas documentales PASS. Se generó una instantánea provisional usando un conversor Markdown disponible localmente **porque `marked` no está instalado**. Este paso no reemplaza la generación oficial.
- `npm run docs:build`: **NO VERIFICADO**, el comando no completa por `ERR_MODULE_NOT_FOUND: Cannot find package 'marked'`. No se trata de un fallo observado en la documentación; la dependencia no está instalada en este entorno.
- `npm run docs:check`: **NO VERIFICADO**, mismo bloqueo de dependencia `marked`.
- Electron visual, UX de búsqueda con teclado y distribución offline en AppImage/Windows: **NO VERIFICADO**.

## QA local obligatorio

1. Ejecutar `npm ci` en el SOURCE_BASELINE completo, con Node/npm compatibles.
2. `npm run docs:build`: debe regenerar `public/docs/content.js` mediante `marked` y actualizar referencias.
3. `npm run docs:check`: debe completar el verificador canónico y `test-docs-web-g001.mjs` sin enlaces ni páginas faltantes.
4. `node --test scripts/test-vcs-docs-g001.mjs`: **9 pruebas esperadas PASS** después del build.
5. `npm run build` y `npm run electron`; abrir ayuda F1 y comprobar sección Git, los siete capítulos, navegación entre páginas, búsqueda de `Clone`, `Fetch`, `Push`, `Pull`, `Ramas`, `token` y `commit`, modo oscuro, panel estrecho y apertura sin Internet.
6. Verificar que el manual no sugiera ejecutar una función que el panel real no ofrezca y que las notas sobre límites de distribución sigan visibles.
7. Si falla una prueba, conservar logs completos, versión de Node y captura del capítulo afectado. **No cerrar Gate ni marcar QA local PASS hasta recibir esa evidencia y aprobación.**

## Riesgos residuales

La generación provisional puede diferir byte a byte de la salida de `marked`. El archivo `content.js` se debe regenerar mediante el comando oficial cuando las dependencias estén disponibles; no editarlo manualmente. El build de Vite y la distribución de Git son verificaciones separadas pendientes de S04.
