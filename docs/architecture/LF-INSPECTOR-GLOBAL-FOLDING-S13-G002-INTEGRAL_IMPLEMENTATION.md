# LF-INSPECTOR-GLOBAL-FOLDING-S13-G002-INTEGRAL · Implementación

**Gate autorizado literalmente el 2026-11-08.** Fuente de autoridad: UX-01..UX-08 de S13-G001, ratificadas por el usuario el 2026-11-08. Estado: **IMPLEMENTADO**, sin QA Electron/visual ni compilación verificados. La ratificación de S13-G001 queda registrada en el ledger sin reescribir su documento histórico.

## Resultado y mecanismos reales

- `InspectorDock.vue` sigue siendo el único delegado de `.sect > header`, conservando `store.prefs.inspFold`, la clase `.closed`, la reactividad, `MutationObserver`, la pestaña/dock, y la navegación por teclado. No se crea un gestor paralelo.
- Las nuevas claves `fold:<contexto>:<id-sección>` no dependen del texto mostrado ni de nombres o IDs de objetos. Contextos: `node:<tipo>`, `resource:<familia>`, `resource:audio-mixer`, `scene`, `pane:mesh/paint/signals`.
- `Inspector.vue` asigna 35 identidades semánticas explícitas a sus grupos de propiedades. Las dos ramas excluyentes de Prefab comparten identidad. No cambian sus campos ni acciones.
- La función de lectura `legacyKeyOf` reconstruye las claves históricas `<tipo>:<título>` y `resource:<título>`. Al encontrar una preferencia antigua se copia a la clave estable sin borrar ninguna entrada histórica. En el contexto ambiguo `resource:*`, el primer contexto observado reclama esa preferencia antigua; los siguientes no la heredan. Los datos del proyecto no se migran ni escriben.
- Para secciones especializadas **todavía sin identidad explícita** se admite `data-testid`, `data-primitive-section` o el índice estructural como solución provisional. **Dependencia:** los Gates S13-G004..G009 deben dotar a cada familia de IDs estables antes de reorganizar la estructura de sus secciones. No considerar esa contingencia como terminación global del plegado.
- Click sobre encabezado/iconos, Enter/Espacio y `aria-expanded` usan el delegado existente. Botones, inputs, enlaces y controles internos no provocan plegado. `:focus-visible` y `display:none` ya existen en `src/styles.css` y se reutilizan sin alterar CSS.
- Ninguna función de edición, audio, materiales, física, render, Preview/Player ni tooltips se modifica.

## Restricciones y no alcance

No se han convertido de forma masiva `details`, `<h4>` ni `section-title` en `.sect`. El plegado local de cada editor continúa hasta sus Gates particulares. No se retiran los párrafos documentales todavía; UX-02 se implementará gradualmente en S13-G003..G009. La clave antigua puede ser ambigua en recursos; se conserva y se asigna solo a una familia para evitar contaminación futura.

## Pendientes QA

- Node focal nuevo: 17 PASS; con Inspector Primitivas histórico: 41 PASS.
- Node compatible: 129 PASS, 1 SKIP, 0 FAIL.
- Ampliado: 192 PASS, 1 SKIP, 4 FAIL preexistentes reproducidos también en SOURCE_BASELINE S13-G001 (175 PASS, 1 SKIP, 4 FAIL sin los 17 nuevos). Los cuatro no se reparan por estar fuera de Gate.
- Electron: 23 comprobaciones incluidas en fixture con componente InspectorDock real, pendiente de ejecución local; Vite no disponible aquí.
- Build Editor/Player: pendiente por ausencia de Vite. QA visual, teclado/docking y usuario: PENDIENTE.
