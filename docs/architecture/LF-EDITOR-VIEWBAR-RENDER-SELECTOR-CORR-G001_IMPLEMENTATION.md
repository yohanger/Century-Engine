> **Supersedida en cuanto a UI:** la selección de render que este Gate incorporó a ViewBar se retira por `LF-EDITOR-VIEWBAR-UX-CA-002`; los resultados de este documento son históricos. El render existente sigue en Ver.

# LF-EDITOR-VIEWBAR-RENDER-SELECTOR-CORR-G001 — Implementación

**Autorización:** `Listo. LF-EDITOR-VIEWBAR-RENDER-SELECTOR-CORR-G001 autoriza comenzar`.
**SOURCE_BASELINE:** `LevelForge_WEATHER_TORNADO_DESTRUCTIVE_S12A_G001_SOURCE_BASELINE.zip`.
**Amendment:** `LF-EDITOR-VIEWBAR-UX-CA-001`.
**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · COMPILACIÓN Y QA LOCAL NO VERIFICADOS · NO CERRADO.

## Auditoría

- **OBSERVADO:** `ViewBar.vue` ya ofrecía grupos de visualización y navegación, pero había retirado el control de render; `commands.js` conserva el menú Ver → Render del viewport; `store.view.renderMethod` ya activa la renderización temporal mediante los watchers originales y `scene/environment.js`.
- **CAUSA RAÍZ:** decisión previa de ubicación que imposibilitaba acceder al perfil desde la barra, no ausencia de renderer ni fallo del estado persistente.
- **CONTRADICCIÓN APROBADA RESUELTA:** `LF-EDITOR-VIEWBAR-UX-CA-001` modifica la prohibición previa solo para el selector editorial. Las pruebas anteriores VIEWBAR-02/07 se ajustan a ese contrato; no se borran ni se neutralizan las restantes pruebas.

## Cambios realizados

1. `src/components/ViewBar.vue`: importa `RENDERERS`/`methodOf`, incorpora `select` accesible en la pestaña Escena con etiquetas Portátil→Mobile, PC→Forward+, Compatibilidad→Compatibility y Del proyecto→`''`. Se representa el método vigente de `project.render`. Reutiliza exclusivamente `store.view.renderMethod` y el diseño de clase `.sel` existente.
2. `scripts/test-editor-viewbar-ux-g001.mjs`: adapta dos aserciones de ubicación a CA-001. Mantiene los otros diez tests anteriores.
3. `scripts/test-editor-viewbar-render-selector-corr-g001.mjs`: prueba catálogo, equivalencia de valores, UI contextual, sincronización con menú, no persistencia y preservación de Player.
4. `package.json`: añade comando reproducible de regresión `npm run test:viewbar-render-selector` con los casos de ViewBar, cámara/FOV, Escena, Snap y Assets.
5. Manual `docs/web-src/editor.md`, Amendment, QA y las seis hojas del ledger: registran intención, verificación automatizada y deuda de QA local sin fabricar resultados.

**Sin cambios:** `project.render`, `render/config.js`, comandos de render, watchers, FOV editorial, preferencias, Player/exportador, escenarios climáticos y gameplay.

## Evidencia y pendientes

El historial de pruebas y los resultados del Gate aparecen en `docs/qa/LF-EDITOR-VIEWBAR-RENDER-SELECTOR-CORR-G001_QA.md`. La ausencia de dependencias de compilación en este entorno no autoriza declarar compilado, QA visual PASS, aprobado ni cerrado. El usuario deberá probar especialmente vistas estrechas, sincronización bidireccional de menú y selector, modo Juego y persistencia del render del proyecto.
