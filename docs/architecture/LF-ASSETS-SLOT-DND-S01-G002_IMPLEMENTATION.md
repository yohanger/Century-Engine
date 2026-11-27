# LF-ASSETS-SLOT-DND-S01-G002 — Slots del Inspector

**Base autorizada:** `LevelForge_ASSETS_SLOT_DND_S01_G001_SOURCE_BASELINE.zip`. **Autorización:** `Listo. LF-ASSETS-SLOT-DND-S01-G002 autoriza comenzar`.

## Auditoría: observado y causa

- `ProjectPanel.vue` emite `application/x-lf-entry` y `application/x-lf-entries` mediante el contrato de G001.
- `Inspector.vue` disponía de selectores para `Decal.props.image` (ID de textura) y `AudioSource.props.clip` / `light.audio.clip` (ID de asset de audio) pero no recibían arrastre.
- `ProfileSlot.vue` utiliza `obj.props.profile` como ID de `store.project.profiles`, y el selector ya llama `updateObject` con commit.
- Los campos `ImageField`, `IconField` y asociación de Script tenían sus destinos y se conservaron.

**Causa raíz:** los slots del Inspector no consumían el contrato MIME validado existente. No es una pérdida del asset ni un defecto de serialización.

## Integración

- `src/components/ResourceDropSlot.vue`: receptor pequeño y local al campo. Reconoce el MIME de G001 y resuelve contra `allEntries(store.project)`, valida `kind` e IDs autorizados por el selector actual, detiene la propagación en destino válido o inválido y emite únicamente el ID. No tiene estado persistente ni crea objetos.
- `Inspector.vue`: Decal acepta `texture` realmente incluida en `decalImages`. Audio acepta `audio` o `file` solo si la extensión pertenece al filtro `AUDIO_EXT` que utiliza el selector existente; se mantiene el `id` del asset. La asignación usa `upd({props:{image:id}})` o `sp('clip', id, true)` (incluye la vía `light.audio`).
- `ProfileSlot.vue`: acepta `profile` de `store.project.profiles` y asigna con `set(id)`, conservando `updateObject` y el perfil por ID. Selección vacía permite quitar la referencia.
- G002 no incluye los slots especializados de Shader Graph, VFX Editor, materiales ni UI Designer (G003 PENDIENTE PLANIFICADO). La opción Canvas `.ui` queda también para G003, por ser autoría especializada. `ParamForm.vue` contiene campos audio diferentes (uno almacena nombre, otro ID): no se alteran ni se conectan en G002 para evitar una migración implícita; se auditarán uno por uno en G003.

## Seguridad y compatibilidad

No se interpreta `text/plain` como autoridad, no se guardan rutas como identidad y no se modifica `.lfproj`. Una selección múltiple, archivo borrado, payload falso o tipo incompatible se rechaza sin actualizar datos. El receptor no intercepta archivos externos del SO; solo los arrastres del Assets Browser. Un rechazo no crea objetos de escena.

El contenedor visual es discreto y reutiliza los selectores existentes para teclado, reemplazo y desasignación. El drop de audio confirma la operación en Undo/Redo con el contrato original `updateObject(...,{commit:true})`.

## QA y limitaciones

Ver `docs/qa/LF-ASSETS-SLOT-DND-S01-G002_QA.md`. Pruebas G001/G002: 41 PASS. Batería seleccionada ampliada: 132 PASS / 1 FAIL (`HC-15`, fallo reproducido en SOURCE_BASELINE de entrada por nuevos campos de serialización, no ocasionado por G002). Build Vite y QA Electron NO VERIFICADOS por dependencias ausentes. El test con VM ejecuta handlers reales sin compilar Vue; no sustituye QA visual.
