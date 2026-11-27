# LF-ASSETS-SLOT-DND-S01-G003 — Slots de editores especializados

**Baseline autorizado:** `LevelForge_ASSETS_SLOT_DND_S01_G002_SOURCE_BASELINE.zip`. **Autorización:** `Listo. LF-ASSETS-SLOT-DND-S01-G003 autoriza comenzar`.

## Auditoría y causa

**OBSERVADO:** `ResourceDropSlot.vue` y `src/core/editor/asset-drop.js` (S01-G001/G002) resuelven el par `kind/id` desde `allEntries(project)` y rechazan arrastres múltiples, datos inválidos y entradas eliminadas. `MaterialSection`, `MaterialShader`, `MaterialSurfaceDetail`, `VfxEditor`, el slot VFX3D de `Inspector` y `UiDesignerPanel` usaban selectores sin el receptor común. `ParamForm` tenía dos ramas `p.type === 'audio'`: la segunda era inalcanzable, y pretendía almacenar IDs, mientras que la primera rama activa almacena nombres.

**CAUSA RAÍZ:** ausencia de conexión con el contrato existente en editores especializados. No faltaba un gestor de archivos ni un sistema de persistencia.

## Integración de G003

- `MaterialSection.vue`: `.material` por ID usando `assignMaterial` / `makeMaterialLocal`; conserva selector, material local y material compartido.
- `MaterialShader.vue`: shader de superficie por ID y setter `setShader`; excluye shaders `graph.target === 'post'`. Los nodos del Shader Graph continúan referenciados por material, sin asignación paralela.
- `MaterialSurfaceDetail.vue`: textura normal/altura por ID y método `change`, sin alterar el modelo de material.
- `VfxEditor.vue`: `appearance.textureId` por ID de imagen mediante `patch` / `updateVfx` con commit normal. Acepta imágenes que el selector ya incluía como `texture` o `file` reconocido.
- `Inspector.vue`: `.vfx` sobre VFX3D por `props.vfxId` mediante `upd`. El recurso permanece compartido y cada instancia conserva su propia simulación.
- `UiDesignerPanel.vue`: audio, imagen y retratos. El receptor valida el ID, y la asignación conserva **nombre del recurso** (`D.setProp` / `portraitEdit`) porque el diseño `.ui` actual almacena nombres, no IDs.
- `ParamForm.vue`: textura, perfil, prefab, modelo y audio. Texture/Profile/Prefab/Model conservan sus IDs o la referencia `prefab:<id>` exigida por modelos que aceptan prefabs. **Audio conserva el nombre del clip**, que es el valor escrito por la rama activa previa. Se elimina exclusivamente la rama muerta, sin migrar proyectos ni modificar el reproductor.

Todos reutilizan `ResourceDropSlot` para validar la identidad contra el proyecto, detener propagación al viewport y señalar el destino; siguen funcionando los selectores y la opción de quitar o reemplazar.

## Límites y riesgos

- Los campos `.ui` y audio de eventos que almacenan **nombres** no ganan persistencia por ID mediante Drag & Drop; siguen sujetos a la semántica histórica de cambio de nombre. No se cambia ese contrato ni se promete que un renombrado preserve referencias nominales.
- No se instala un selector nuevo de recursos, no se duplica el registro y no se convierte un drop en creación de un nodo.
- Los archivos externos del sistema operativo no se interpretan como recursos internos por este mecanismo.
- `ShaderGraphEditor.vue` no incorpora un destino nuevo: mantiene su vínculo actual con el material. Rediseño visual y funcionalidades adicionales quedan fuera del Gate.
- Tests Node ejercitan los handlers del receptor y funciones de asignación de UI sin Vue/Electron; no equivalen a compilación SFC, QA visual ni persistencia real del proyecto.

## QA

Ver `docs/qa/LF-ASSETS-SLOT-DND-S01-G003_QA.md`. Compilación y QA local son pendientes hasta que el usuario ejecute Electron y el build con dependencias instaladas. S01-G004, integración final, permanece **PENDIENTE PLANIFICADO**.
