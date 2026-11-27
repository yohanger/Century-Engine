# LF-INSPECTOR-PRIMITIVES-UX-S01-G001 — Implementación visual acotada

**Autorización literal:** `Listo. LF-INSPECTOR-PRIMITIVES-UX-S01-G001 autoriza comenzar` (2026-11-01).
**Base vinculante:** `LevelForge_EDITOR_VISUAL_LANGUAGE_AUDIT_S00_G001_SOURCE_BASELINE.zip`.
**Contrato de referencia:** `docs/architecture/LF-EDITOR-VISUAL-LANGUAGE-S00-G001_CONTRACT.md` (paleta candidata, todavía no aprobada para el Editor completo). Este Gate concreta solo la legibilidad de primitivas, sin activar una paleta global.

## Auditoría del código real

- `Inspector.vue` conserva selección, cabecera, `TagLayerRow`, `DontDestroyOnLoad`, Transform (tamaño por eje + multiplicador independiente), Cut, Prefab, Script, Material, Iluminación, Malla, Escalera y acciones existentes. El orden heredado sitúa cortes lejos de Transformación y MaterialSection usa otra alineación para sus campos.
- `MaterialSection.vue` contiene fuente única para material local/compartido, shader, detalle, escurrimiento y acústica; se monta una vez por objeto. Conserva `<details>` anidados.
- `InspectorDock.vue` determina la clave del plegado a partir del texto del encabezado. No modificar nombres de sección ni el mecanismo de plegado.
- `src/styles.css` ya aporta `--g-*`, `.sect`, `.field`, ancho redimensionable `--lf-property-label-width` y regla responsive de 260px. Se reutilizan estos elementos.

## Implementación

1. **Cabecera de primitiva**: superficie diferenciada y campo de nombre más legible. Se conservan visible, bloqueo, tipo/ruta, Tag/Layer y DontDestroyOnLoad en su ubicación funcional original.
2. **Secciones de primitivas**: atributo `data-primitive-section` solo con `obj.type === 'primitive'` para Transformación, Script, Prefab, Materiales, Iluminación, Escalera y Malla; Cortes, exclusiva de primitiva, posee identificador propio. Las reglas CSS son locales al Inspector de primitivas.
3. **Cortes**: se reposiciona después de Transformación, sin cambiar comandos `bakeCuts` o la propiedad `carve`. Resto de bloques se conservan, evitando duplicar UI y lógica entre nodos.
4. **MaterialSection**: propiedad de presentación `primitiveLayout` (por defecto `false`). Activa `mr-primitive` únicamente para primitivas; el mismo MaterialSection sigue siendo autoridad de datos y botones.
5. **Material compacto**: recurso, campos, subgrupos y acciones en paneles grises con separación clara. Reutiliza la misma columna de etiquetas del Inspector y apilado responsive a 260px.
6. **Accesibilidad**: se conservan `details/summary`, navegación de teclado, foco visible, tooltips existentes y la identificación textual del plegado.

## Alcance negativo y continuidad

- No se modifican `store`, `project`, objetos, serializers, Player, geometría, event system, scripts, Prefab, material data ni el render.
- No se sustituye Tags por Groups. No se toca Inspector de Escena, tabs de Terrain, Assets, gizmos ni tema global. Esas decisiones requieren Gates posteriores.
- No se elimina `Tamaño` ni `Escala ×` porque representan operaciones distintas. Se mejora el tooltip de la escala uniforme.
- La aceptación exige Electron con Vue real, panel de 260px, comparativa visual Unity/LevelForge y pruebas con primitivas de distintos tipos; ninguna comprobación Node sustituye ese QA.

## Evidencia disponible

- Test nuevo `scripts/test-inspector-primitives-ux-s01-g001.mjs`: 24/24 PASS.
- Regresión focal con test nuevo/material/escala: 85/85 PASS.
- Batería ampliada: 228 PASS, 2 FAIL, 0 SKIP. Los dos FAIL (`G005-13`, `SCENE-09`) reproducidos idénticamente en la base original S00.
- `test-editor-inspector-integration-corr-g001.mjs`: 6 PASS, 8 FAIL en nuevo y en baseline original (test histórico evalúa fragmento ES module `export` en `vm`).
- Runner Electron preparado con componente Vue real: no ejecutado por falta de `node_modules/vite`; `npm run build` falla `vite: not found`.

**Estado:** IMPLEMENTADO · TEST NODE NUEVO PASS · BUILD NO VERIFICADO · ELECTRON/PLAYER/QA LOCAL PENDIENTE · NO CERRADO.
