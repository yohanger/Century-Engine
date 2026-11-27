> **Histórico únicamente.** CA-001 queda SUPERSEDIDA. El contrato vigente es CA-002 (icono Ratón/Trackpad; render solo en menú Ver). Su contenido se conserva para trazabilidad.

# LF-EDITOR-VIEWBAR-UX-CA-001 — Selector editorial de render en ViewBar

**Estado contractual:** SUPERSEDIDA íntegramente por `LF-EDITOR-VIEWBAR-UX-CA-002`. Fue aprobada históricamente, pero **ya no es vinculante para la UI actual**. APROBADO para `LF-EDITOR-VIEWBAR-RENDER-SELECTOR-CORR-G001` mediante autorización literal `Listo. LF-EDITOR-VIEWBAR-RENDER-SELECTOR-CORR-G001 autoriza comenzar`.

**Contrato padre:** `LF-EDITOR-VIEWBAR-UX-G001_IMPLEMENTATION.md` y su QA, junto al esquema de render y comandos vigente.

## Enmienda vinculante

1. Se **sustituye exclusivamente** la decisión de retirar el selector de render de `ViewBar.vue`: podrá mostrarse nuevamente en la pestaña **Escena** de la barra superior, como selector editorial compacto. Las restantes prohibiciones sobre FOV, navegación, tamaño del gizmo y operaciones duplicadas continúan vigentes.
2. Los cuatro elementos visibles son **Del proyecto**, **Portátil**, **PC** y **Compatibilidad**. Son **etiquetas de interfaz**, no hardware autodetectado: `''`, `'mobile'`, `'forward'`, `'compat'` respectivamente.
3. El catálogo de perfiles sigue siendo `RENDERERS` en `render/config.js`. La selección continúa usando únicamente `store.view.renderMethod`, sin nuevos estados, perfiles, presets, renderizadores, almacenamiento de usuario o servicios.
4. **Del proyecto** limpia el override (`''`) y devuelve el render normalizado de `project.render`. La barra presenta el método de proyecto junto a esa etiqueta. Cambiar el visor no modifica `project.render` ni la configuración exportable.
5. El submenú **Ver → Render del viewport** se conserva y opera sobre el mismo estado. Ambos selectores deben reflejar inmediatamente los cambios del otro.
6. El control solo aparece en **Escena**. No se agregan controles al modo Juego, Edit Mesh ni Player. El visor estrecho mantiene acceso por desplazamiento horizontal y el selector debe aceptar foco y teclado nativos.
7. Se modifican **solo** las aserciones de VIEWBAR-02 y VIEWBAR-07 incompatibles con esta enmienda. No se eliminan los controles restantes del contrato anterior ni se cambian `PreferencesModal.vue`, `commands.js`, los watchers, `GameSettingsModal.vue` o la semántica del renderer.

El cambio es prospectivo. Los resultados y decisiones históricos de G001 permanecen documentados; la ubicación del selector desde esta enmienda prevalece sobre su prohibición antigua.
