# LF-DOCS-WEB-G001 — QA técnico y de cobertura

**Fecha:** 2026-10-28  
**Estado:** Implementado; QA automático PASS; QA local Editor/Electron pendiente.

## Evidencia automatizada

- `node --test scripts/test-docs-web-g001.mjs`: **12 PASS / 0 FAIL / 0 SKIP**. Comprobaron estructura HTML/CSS/JS, ids únicos, cobertura API, comandos, nodos, enlaces, headings, integración Ayuda, scripts y ausencia de ECS.
- Suite ampliada `scripts/test-*.mjs` (excluidos `test-starcat*` y `test-clouds*`): **2.248 PASS / 0 FAIL / 19 SKIP**, **105 archivos**.
- `node scripts/gen-docs.mjs`: regeneró API/comandos desde código; `node scripts/gen-docs.mjs --check`: PASS después de generar.
- Sintaxis de `app.js`, `content.js` y generador: `node --check`: PASS.
- Chromium con contenido HTML y assets inyectados (Playwright, desktop 1440 × 900 y móvil 390 × 844): navegación **179 entradas**, búsqueda de `NodeScriptHandle`, selección, tema oscuro y menú móvil PASS; **sin errores JS**.
- Integridad de referencias: 49 interfaces API, 70 comandos, 31 nodos; enlaces de ruta comprobados con prueba automatizada.

## Limitaciones expresas

- Chromium de este contenedor bloquea por política `file://` y `localhost`; la prueba visual se efectuó mediante `set_content` e inyección local de CSS/JS, sin probar navegación real desde URI/servidor.
- No hay `node_modules`: `npm run build` falla por `vite: not found` y el generador web que requiere la dependencia existente `marked` no se ejecutó en este contenedor. Se entrega el contenido `content.js` ya generado y validado en Node y Chromium. **`npm run docs:build` / `docs:check` deben repetirse con dependencias instaladas**.
- Electron, AppImage y Player exportado: NO VERIFICADOS aquí.
- No se han ejecutado funcionalmente todas las funciones declaradas de la API; la documentación las reproduce del archivo de tipos.

## QA local requerido

1. Tras aplicar CHANGE, ejecutar `npm run docs:build` y `npm run docs:check`, y confirmar que terminan sin errores.
2. Ejecutar `npm run build` y verificar `dist/docs/index.html`, `dist/docs/app.js`, `dist/docs/styles.css` y `dist/docs/content.js`.
3. Ejecutar `npm run electron`; abrir Ayuda → Documentación (F1) y verificar búsqueda, enlaces, código y temas.
4. Abrir `public/docs/index.html` directamente en Chrome/Firefox sin conexión a Internet; navegar entre API, comandos y nodos.
5. Reducir el ancho de la ventana a 560 px y de navegador a 390 px; verificar panel móvil, búsqueda, tablas y código sin desbordamiento horizontal no recuperable.
6. Probar atajos Ctrl+K, Escape, Intro y flechas en búsqueda, navegación por teclado y accesibilidad.
7. Confirmar que la documentación de `NodeScriptHandle` describe scripts por nodo y que el catálogo ofrece Box/Sphere/Capsule.
8. Confirmar que SceneGraph, Event Order Flow y Player mantienen comportamiento anterior; el Gate no debe modificar su código.

## Resultado contractual

La implementación **no** debe marcarse cerrada por QA local hasta recibir evidencia del usuario. No confundir el éxito de 12 pruebas unitarias y una prueba de DOM inyectado con un build de Electron verificado.
