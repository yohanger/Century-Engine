# LF-DOCS-WEB-G001 — Contrato de documentación general

**Gate autorizado:** 2026-10-28  
**Base:** `LevelForge_NODE_EDITOR_S06_G001_SOURCE_BASELINE.zip`, 939 entradas.  
**Alcance:** portal de documentación HTML/CSS/JavaScript integral, offline, español, con navegación dentro de Electron y en navegador.

## Arquitectura

1. `public/docs/index.html`: entrada HTML semántica. `styles.css`: estilos claros/oscuros, layout responsive. `app.js`: navegación por hash, índice lateral, tabla de contenido, búsqueda, atajos y copia de código. `content.js`: catálogo generado y listo para consultar sin HTTP ni servidor.
2. `docs/web-src/*.md`: manuales y tutoriales de autoría para publicación; el **resultado distribuido** es HTML/CSS/JS, no un visor Markdown.
3. `scripts/gen-docs.mjs`: generador existente de API y comandos en Markdown desde `game-api.d.ts` y `commandDefs.js`.
4. `scripts/gen-docs-web.mjs`: transforma esos documentos y el inventario de nodos existente en el catálogo web. Utiliza `marked`, dependencia YA presente en `package.json`.
5. `DocsWindow.vue`: extiende la ventana de ayuda existente mediante un iframe local, sin duplicar editor, estado de recursos ni SceneGraph. Las rutas legacy de Ayuda se redirigen al contenido web.
6. Los recursos web viven bajo `public/`, que Vite copia a `dist/`. El iframe usa ruta relativa para ser compatible con Electron empaquetado mediante `file://`.

## Cobertura comprobada en el paquete inicial

- **179 páginas de contenido navegables:** 49 interfaces de API, 70 comandos de evento, 31 tipos de nodo, manuales y tutoriales.
- Referencias de API basadas en `src/core/events/game-api.d.ts` (incluye `NodeScriptHandle`).
- Referencias de comandos basadas en `src/engine/runtime/events/commandDefs.js`.
- Referencias de nodos derivadas del registro fuente sin importar Three.js en el generador.
- Distingue scripts Global y Nodo; Event Order Flow, física Jolt y nodos especializados; exportación, UI, Database, audio y render.

## Reglas de continuidad

- No hay migración ECS, ni modificación de páginas, comandos, señales o del runtime de eventos.
- El código y las definiciones fuente son la autoridad para APIs, comandos y nombres de nodos. Una firma documentada no equivale a QA en hardware.
- Un solo portal distribuido; no mantener versiones diferentes para Electron y navegador.
- `npm run docs:build` regenera las referencias y el portal. `npm run docs:check` valida actualización y pruebas.
- No incorporar scripts externos, CDNs, tipografías remotas ni llamadas `fetch` durante lectura.

## Límites y evidencia

Las pruebas de cobertura y navegación automatizada no acreditan por sí mismas compilación Vite, distribución Electron o funcionamiento con `file://` cuando el entorno de pruebas bloquea esa navegación. El portal generado está presente para funcionamiento local sin red; su QA visual definitivo corresponde a una instalación completa del editor.
