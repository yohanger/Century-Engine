# LF-VFX-INSPECTOR-UX-CORR-G001 — corrección de selectores y guardado VFX

**Autorización exacta:** `Listo. LF-VFX-INSPECTOR-UX-CORR-G001 autoriza comenzar`.

**SOURCE_BASELINE:** `LevelForge_WEATHER_TORNADO_TRANSITIONS_S02_G001_SOURCE_BASELINE.zip` (1.250 archivos; integrado sobre S01, sin reabrir los Gates previos).

**Contrato vinculante:** `LF-VFX-INSPECTOR-CA-001`; guardado existente `src/core/state/project.js` y atajo `src/core/editor/keys.js`.

**Estado:** IMPLEMENTADO · NODE PASS · VITE/VUE/WEBGL/PLAYER QA LOCAL NO VERIFICADO · **NO CERRADO**.

## Auditoría previa

- **OBSERVADO:** el selector `Espacio` aparece cortado en la captura aportada por el usuario; otros dropdowns también presentan problemas. En `src/styles.css` el `select` común tiene `height:var(--h)` (24 px en el tema), pero `.vfx-row select` de `VfxEditor.vue` aplicaba `padding:6px` arriba y abajo.
- **CAUSA RAÍZ DEL RECORTE:** combinación de altura global pequeña y padding vertical local incompatible con la lectura del texto en Chromium.
- **OBSERVADO:** `VfxEditor.vue` declaraba un botón Guardar que ejecutaba `confirm(); saveAll()`; el Editor ya ofrece `file.save` y Ctrl+S vinculados a `saveAll()` en su ruta única.
- **OBSERVADO:** el editor llama `finishVfxEdit(id)` tras los gestos de entrada y al desmontarse; `updateVfx()` actualiza el documento compartido y registra el historial. No es necesario un botón local para consolidar cambios.

## Intervención limitada

1. `src/components/VfxEditor.vue`: `select` dentro del VFX usa alto de 30 px, `box-sizing:border-box`, padding vertical cero y mantiene el ancho adaptable de 64%; no se cambia `src/styles.css` ni se modifica ningún otro Inspector.
2. Se elimina el botón Guardar y su importación de `saveAll` en el editor VFX, conservando el pie con mensajes/estado, el método de commit, historial y preview.
3. `scripts/test-vfx-inspector-s01-g001.mjs`: se sustituye la aserción histórica VI-22 que exigía el botón por el contrato vigente: no duplicar el guardado centralizado y confirmar el último gesto al desmontar.
4. `scripts/test-vfx-inspector-ux-corr-g001.mjs`: seis pruebas nuevas que verifican CSS local, controles, API existente de guardado, historial y harness UI. Se añade inspección geométrica a `scripts/fixtures/vfx/s03/ui.html` para las pestañas con selectores.
5. `docs/qa/LF-VFX-INSPECTOR-UX-CORR-G001_QA.md` y las seis hojas del ledger registran el alcance y los estados verificables.

## Verificación de implementación

- `node --test` de diez suites de regresión: **261 PASS / 0 FAIL / 0 SKIP**, seis pruebas nuevas UX.
- `npm run build`: **NO VERIFICADO**: falla con `vite: not found` porque el ZIP excluye `node_modules`.
- `npm run test:vfx-inspector:ui`: **NO VERIFICADO**: harness no inicia por ausencia de `node_modules/vite/bin/vite.js`.
- Render real en Chromium, interfaz estrecha, comportamiento nativo de menús select, Editor, Player y export: **PENDIENTE DE QA LOCAL**.

## Fuera de alcance

El tornado que aparece como quad negro y la formación meteorológica ausente pertenecen a `LF-WEATHER-TORNADO-VISUAL-FORMATION-CORR-G001`, **NO autorizado dentro de este Gate**. Tampoco se modifica VFX3D, render WebGL, Jolt, `World`, clases de eventos, persistencia ni estructura de proyecto.

La suite Node valida contratos y lógica, pero **no demuestra** la ausencia de recortes visuales en el hardware del usuario. El cierre requiere QA local y aprobación expresa.
