# LF-INSPECTOR-GLOBAL-UX-CLEANUP-S13-G001 — Auditoría del Inspector real

**Gate documental autorizado literalmente:** `Listo. LF-INSPECTOR-GLOBAL-UX-CLEANUP-S13-G001-AUDIT-CONTRACT autoriza comenzar` (2026-11-08).  
**SOURCE_BASELINE vinculante:** `LF_INSPECTOR_AUDIO_VOLUME_POINTS_S12_G007_G001_INTEGRAL_CORR001_SOURCE_BASELINE.zip` (2.650 archivos).  
**Alcance ejecutado:** lectura estática de contratos/código, clasificación, pruebas no mutantes y ledger. No se modifica `src/`, `scripts/` ni los datos de proyecto.  
**Estado de las propuestas del contrato:** **RECOMENDADO**, pendiente de ratificación del usuario; la autorización para redactar no aprueba cláusulas nuevas.

## 1. Montaje real, identidad y propiedad

- `src/App.vue:22,322` y `src/components/DockPanelBank.vue:7,56` montan **el mismo** `InspectorDock.vue` dentro del sistema de ventanas; no hay que reconstruir ni duplicar el dock.
- `src/components/InspectorDock.vue:1-112` distribuye cuatro pestañas/contextos (`object`, `signals`, `mesh`, `paint`) y, dentro de `object`, deriva a `CinematicResourceInspector`, `TemporalResourceInspector`, `ProfileEditor`, `MaterialResourceEditor`, `LiquidResourceEditor`, `GameManagerEditor`, `VfxEditor` o `Inspector.vue`. El `Inspector.vue` tradicional puede montar `AudioMixerInspector`, `ScenePanel`, `TerrainPanel`, `RoadPanel`, `WaterPanel`, `MaterialSection`, `InteractionZonesPanel` según contexto. El contrato debe incluir **todos estos montajes**, pero los cambios se dividirán en Gates pequeños.
- `InspectorDock.vue:47-74` reconoce únicamente `.sect > header`, calcula la clave `contexto:etiqueta` desde el texto visible del encabezado, escribe `store.prefs.inspFold` y asigna `role=button`, `tabindex=0`, `aria-expanded`; el CSS `src/styles.css:115-131` oculta los hermanos de `header` cuando hay `.sect.closed`. **OBSERVADO:** un `<h4>`, `section-title`, árbol de señales o panel con estructura propia no queda automáticamente cubierto por ese selector. **RIESGO INFERIDO:** colisiones/inestabilidad de claves por encabezados traducidos, dinámicos o repetidos dentro del contexto `resource`; es necesario un contrato de identidad estable y una migración no destructiva antes de cambiarlo.
- `src/core/state/state.js:23` conserva `inspFold`. No introducir otro gestor ni persistencia paralela.

## 2. Texto documental y contradicción UX

- `src/styles.css:160-165` oculta `.idock p.hint`, `.note.help` y `.lf-help` cuando `html` **no** posee `lf-tips`; `src/core/tooltips.js:11-16` añade esa clase al activar tooltips; `src/components/PreferencesModal.vue:36` permite configurar «Mostrar tooltips». Por tanto, **no es correcto concluir** que todos los párrafos de `.hint` aparezcan siempre: su visibilidad depende de preferencia, clase y contexto.
- Los párrafos `.note` de `TemporalResourceInspector.vue:454,459,465,482,497,513,556` son ejemplos de texto instructivo sin `lf-help`; mensajes como `methodNameError` en líneas 550-555, nodo receptor ausente 546 y `Duración requerida` 527 son validaciones/estados que deben permanecer.
- `Inspector.vue:300,310,316` enseña cómo añadir CollisionShape3D; `Inspector.vue:343,351,452,548,549,783,882` presenta también condiciones operativas, referencias no válidas, valores rechazados o estados. **No se deben borrar por una búsqueda masiva de `.hint`.** Algunos avisos están marcados `lf-help` a pesar de describir un fallo real; requieren reclasificación semántica previa, no supresión.
- `ScenePanel.vue:107,117,122,134-150` mezcla instrucciones de transiciones y modos con autoridad de World y aviso de DirectionalLight ausente; `ScenePanel.vue:159,169` señala estados de autoridad. La documentación se compactará, pero no se eliminarán indicadores de autoridad ni se alterará el reset heredado (`LF-SCENE-INSPECTOR-OWNERSHIP-S02-G001_IMPLEMENTATION.md`).
- `TerrainPanel.vue:342,352,413-415,520,545-555` combina instrucciones de herramientas, unidades y operaciones destructivas; `TerrainPanel.vue:322,547,548,570` contiene ausencia de terreno, compatibilidad de costa y advertencias de rendimiento. El contrato debe preservar las últimas.
- `node scripts/audit-help-text.mjs --check` devuelve **EXIT 1 con 134 avisos en todo `src/`**, incluidos componentes ajenos al Inspector; esta cantidad NO es una cifra de textos a eliminar del Inspector ni un defecto nuevo creado por este Gate. No ejecutar `--fix` sin otro Gate y revisión semántica.

## 3. Inventario técnico y fronteras

Consulte `docs/qa/LF-INSPECTOR-GLOBAL-UX-CLEANUP-S13-G001_COVERAGE.md`: contexto, archivo, patrón, texto, riesgo y Gate posterior. Los recuentos `.sect`/`details` son inspección textual del baseline, **no** cantidad de secciones visibles simultáneamente (muchas usan `v-if`).

## 4. Contratos parent auditados

- `docs/architecture/LF-TERRAIN-INSPECTOR-CONTEXT-S04A-G001-INTEGRAL_CONTRACT.md`: Terreno se inspecciona sobre el **nodo seleccionado**; una sola identidad y `TerrainPanel` montado bajo `Inspector`, sin pestaña Terrain nueva.
- `docs/architecture/LF-SCENE-INSPECTOR-OWNERSHIP-S02-G001_IMPLEMENTATION.md`: la autoridad de Escena, World y Bake es distinta; no eliminar señales de autoridad ni cambiar `resetSection`.
- `docs/architecture/LF-VFX-INSPECTOR-CA-001.md`: recurso VFX editado en el Inspector, sin nueva ventana, preview explícita y sin introducir propiedad `tornadoFlow` legacy en autoría.
- `docs/architecture/LF-TIMELINE-AUDIO-CLIP-FX-UX-CONTRACT-S12-G006-G001_AMENDMENT.md`: `key.fx` histórico debe conservarse, con indicador de solo lectura y sin editor de efectos individuales.
- `docs/architecture/LF-INSPECTOR-AUDIO-VOLUME-POINTS-S12-G007-G001-INTEGRAL_IMPLEMENTATION.md` y corrección QA G001: nombres opcionales persistentes, encabezados por punto, scroll desde cinco, sin alterar DSP ni AudioEngine.
- `docs/architecture/LF-INSPECTOR-PRIMITIVES-UX-S01-G001_IMPLEMENTATION.md`: el patrón de propiedades de primitivas ya existe; se extiende, no se sustituye.

## 5. Evidencia ejecutada (no cambios de producción)

- `docs/qa/evidence/LF_INSPECTOR_S13_G001/help_audit_baseline.log`: auditor existente, **EXIT 1 (134 avisos a escala src)**. No corregido ni convertido en PASS.
- `docs/qa/evidence/LF_INSPECTOR_S13_G001/inspector_readonly_regression.log`: 56 pruebas ejecutadas, **55 PASS / 1 FAIL**, sin cambio de código. `SCENE-09` falla en la aserción estática `src/core/mesh/session.js - translate`; no se atribuye a este Gate documental ni se alteró el test para forzarlo a PASS.
- Electron, compilación, captura visual y Player: **NO VERIFICADOS** en este Gate exclusivamente documental.

## 6. Causa, inferencia y bloqueo

**OBSERVADO:** hay estructuras heterogéneas y un delegado de plegado que no las cubre por su selector. También hay ayuda visible condicional, avisos necesarios y texto de instrucción en varias familias.  
**INFERENCIA:** la heterogeneidad y la preferencia de ayudas contribuyen a la apariencia «sucia»; no se ha medido la contribución visual de cada apartado ni se acredita una causa raíz única con evidencia de Electron.  
**CAUSA TÉCNICA LIMITADA CONFIRMADA:** `.sect > header` no cubre `TerrainPanel.vue` y otras estructuras no `.sect` de manera automática.  
**BLOQUEO CONTRACTUAL:** convertir «sin texto documental» en regla independiente de `tooltips=true` cambia la política de visibilidad anterior de `src/styles.css`; debe ser aprobada por el usuario en el contrato UX. No se cambia `src/core/tooltips.js` en este Sprint por decisión expresa del usuario.  
**BLOQUEO DE IMPLEMENTACIÓN:** ningún Gate futuro ni modificación `src/` está autorizado por la autorización documental G001.
