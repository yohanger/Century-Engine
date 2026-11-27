# LF-VFX-BLACK-ARTIFACT-CORR-G001 — Correctivo del rectángulo negro VFX

## Fuente de autoridad

Gate autorizado por el usuario. Baseline de entrada: `LevelForge_WEATHER_STORM_BLACK_ARTIFACT_CORR_G001_AUDIT_SOURCE_BASELINE.zip` (incluye S04). El contrato de emisión, recursos `.vfx`, VFX3D, Player y Editor no cambia.

## Evidencia y separación de diagnóstico

**OBSERVADO POR USUARIO:** (1) recurso nuevo con partículas: rectángulo negro; (2) cero partículas: desaparece; (3) partículas presentes y opacidad cero: persiste. La captura no prueba por sí sola qué pase produjo los píxeles.

**OBSERVADO EN CÓDIGO:** `VfxBillboardRenderer` dibuja quads mediante atributos de instancia (`aCenter`, `aParams`) y descarta fragmentos transparentes. `LookPipeline` utiliza `GTAOPass` en perfil alto. El addon oficial Three.js r170 renderiza su buffer de normales/depth con `scene.overrideMaterial` y no excluye Mesh transparentes, solo Points y Lines: https://github.com/mrdoob/three.js/blob/r170/examples/jsm/postprocessing/GTAOPass.js

**CAUSA TÉCNICA DEMOSTRADA EN CÓDIGO:** GTAO no respeta ni los atributos específicos de VFX ni `discard` de su shader de apariencia al sustituir el material. En su G-buffer trata el quad base unitario como un mesh opaco, incluso cuando el recurso VFX no es opaco. Eso explica un posible rectángulo oscuro en AO. **La causa exacta de las capturas del usuario sigue PENDIENTE de confirmación Electron real.**

## Intervención mínima

- `src/engine/runtime/vfx/render.js`: se marca el mesh VFX como excluido de G-buffer GTAO; se omite el dibujo de todas las partículas si su opacidad efectiva es nula. No se cambia su shader ni su geometría base.
- `src/engine/runtime/render/look.js`: sobre el `GTAOPass` oficial se amplía exclusivamente el paso de visibilidad previo al G-buffer para ocultar los VFX; `restoreVisibility()` nativo restaura los valores tras el pase. El render principal, AO de sólidos y otros materiales siguen intactos. Se aplica tanto al composer único como al de resolución interna.
- No se crea otro renderer, ni archivo `utils` genérico, ni nuevos gestores, ni cambios a `PrecipFX` o `CloudField`.

## Compatibilidad, límites y dependencias

Los VFX siguen disponibles en Editor, VFX Preview, Player y export; los archivos `.vfx` no requieren migración. Los efectos de lluvia y niebla usan sus propias geometrías: la causa del artefacto en Tormenta sin tornado permanece bajo `LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001` y no se declara resuelta aquí.

Ejecución Node disponible: **40 PASS, 0 FAIL, 0 SKIP** sobre 4 suites (VBQ, VFX-Q06, WU4, SA). La suite histórica que requiere `jszip` NO SE EJECUTÓ por dependencia ausente. Electron/WebGL, Vite, Editor/Player y QA visual NO VERIFICADOS en este entorno. No cerrar por los tests Node.

## CORR-001 — bloqueo de arranque por integración con GTAOPass (2026-10-31)

**OBSERVADO EN QA DEL USUARIO:** `Cannot read properties of undefined (reading 'bind')` en `LookPipeline._excludeVfxFromAO`, invocada desde `_buildSingle` durante render y resize. El fallo impide renderizar antes de cualquier evaluación visual del cuadro negro.

**CAUSA RAÍZ DEMOSTRADA:** el correctivo inicial intentaba `pass.overrideVisibility.bind(pass)`, pero el addon `GTAOPass` de Three.js usado por LevelForge expone `_overrideVisibility()` y `_restoreVisibility()`, con `_visibilityCache` como array. La propiedad sin guion bajo es `undefined`. Se contrastó el addon oficial r186: https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/GTAOPass.js

**CAMBIO:** `look.js` extiende el método real `_overrideVisibility` y añade únicamente VFX visibles a la caché propia de GTAO, que restaura la visibilidad posteriormente. Los objetos sólidos permanecen en el G-buffer; también se conserva la exclusión nativa de Points/Lines. Si un addon futuro deja de exponer este contrato, el editor no invoca `.bind` sobre `undefined` y registra una advertencia de incompatibilidad; ello no acredita la exclusión VFX en tal versión.

**FIXTURE:** `black-artifact.html` ahora utiliza la API real `_overrideVisibility`/`_restoreVisibility`. Las pruebas Node comprueban exclusión y restauración, Points, alfa cero y fallback sin excepción.

**QA:** 42/42 Node PASS, 0 FAIL, 0 SKIP en cuatro suites. Electron WebGL real, compilación, Editor, Player y desaparición visual del artefacto: NO VERIFICADOS en esta revisión. El error de CSP de Electron y el aviso CSS `slider-vertical` son incidencias separadas; no se alteraron.

**Estado:** CORRECCIÓN IMPLEMENTADA; QA LOCAL PENDIENTE; GATE NO CERRADO.
