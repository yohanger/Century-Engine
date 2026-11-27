# Century Engine — mantenimiento interno de la documentación

Referencia histórica: `LF-DOCS-WEB-G001`.

La documentación pública se encuentra en `public/docs/index.html` y es HTML/CSS/JavaScript autónomo. `content.js` está precompilado: funciona desde `file://` sin peticiones ni servidor.

## Archivos de autoría

- `docs/web-src/*.md`: manuales/tutoriales que se compilan a HTML para el portal; su contenido se revisa frente al código de producción.
- `docs/referencia/api.md`: referencia generada desde `src/core/events/game-api.d.ts`.
- `docs/referencia/comandos.md`: referencia generada desde `src/engine/runtime/events/commandDefs.js`.
- `src/engine/runtime/nodes/*.js`: registro y definiciones para las páginas de nodos.
- `scripts/gen-docs-web.mjs`: convierte esas fuentes en `public/docs/content.js` utilizando **marked**, dependencia existente del editor.
- `public/docs/index.html`, `styles.css`, `app.js`: interfaz autónoma. **No** contienen dependencias externas.

## Uso

```bash
npm run docs:build
npm run docs:check
```

Ejecuta primero `npm install` en una instalación nueva para disponer de `marked` y Vite. `docs:build` también actualiza las referencias Markdown existentes.

En una compilación Vite, `public/docs/*` se copia a `dist/docs/*`. `src/components/DocsWindow.vue` usa una URL relativa, válida durante desarrollo y al distribuir el editor empaquetado.

## Controles

- Comparar conteo de comandos con `commandDefs.js`, interfaces con las definiciones y tipos de nodo con el registro.
- No documentar una función que no esté en código; distinguir contrato declarado de funcionamiento verificado.
- Mantener enlaces internos y rutas `#/id` válidas; el portal utiliza navegación por hash para no requerir servidor.
- Realizar QA visual en Chrome/Firefox y Electron, incluidos docks estrechos y modo sin red.
- El portal no modifica Event Order Flow, física ni scripts de juego.

## Límites de este Gate

La documentación registra la versión 0.26.13. Las referencias extensas proceden de firmas y descripciones fuente, no de una ejecución exhaustiva de cada método. Jolt WASM, compatibilidad de plataformas y Player exportado requieren QA local.

## Sección Git — LF-VCS-DOCS-G001

Las siete páginas `docs/web-src/vcs-*.md` documentan únicamente las operaciones reales S01–S04 del panel `src/components/VersionControlPanel.vue` y su backend Electron. La navegación y la búsqueda se generan desde `scripts/gen-docs-web.mjs` hacia `public/docs/content.js`; no se edita el portal HTML a mano.

Después de cualquier cambio, ejecuta `npm run docs:build`, `npm run docs:check` y `node --test scripts/test-vcs-docs-g001.mjs`. Si `marked` no está instalado, instala las dependencias antes: **no** se considera comprobado `docs:build` ni `docs:check` sin ejecutarlos. Electron, HTTPS real y distribución mantienen QA local pendiente.

## Criterio editorial público

El portal enseña a utilizar el motor. Los manuales internos `docs/web-src/intellisense.md` y `docs/web-src/mantenimiento.md` se conservan como antecedentes fuera del registro de páginas públicas. El archivo `docs/architecture/DOCUMENTATION_PUBLIC_EDITORIAL_HISTORY.md` conserva el contenido editorial anterior, incluyendo límites de distribución de Git, detalles de integración y procedimientos históricos del agua. No publicar rutas fuente, instrucciones de empaquetado ni historial de QA en las páginas de uso.

## Biblia Técnica

La sección «Biblia Técnica» separa ingeniería del motor de los manuales de autoría. Los capítulos se mantienen en `docs/biblia/`; el inventario se deriva del repositorio con TypeScript (dependencia dev existente). El portal incluye el índice completo y búsqueda offline. Tras `npm run docs:build`, generar la edición PDF con `python3 scripts/export-engineering-bible.py` (WeasyPrint instalado en el entorno documental; no es necesario para Century). El PDF histórico se conserva sin modificaciones. `docs:check` verifica la correspondencia del portal regenerado; no certifica la vigencia de los contratos ni las rutas dinámicas del runtime.
