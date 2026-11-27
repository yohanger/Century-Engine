# LF-ASSETS-SLOT-DND-S01-G001 — Contrato de arrastre y validación

## Fuente y alcance

Baseline: `LevelForge_VCS_DOCS_G001_SOURCE_BASELINE.zip`. Gate autorizado: `Listo. LF-ASSETS-SLOT-DND-S01-G001 autoriza comenzar`.

**OBSERVADO:** `ProjectPanel.vue` emitía `application/x-lf-entries` para movimientos múltiples y `application/x-lf-entry` para el primer archivo. `script-drop.js`, `ImageField`, `IconField` y `TerrainPanel` interpretaban las cargas por separado. Los destinos de la escena consumen también esas cargas.

**CAUSA DEL RIESGO:** el contenido JSON identificaba recurso y tipo, pero algunos destinos confiaban en ambos sin confirmar que el recurso aún existiese en el proyecto o que el payload individual coincidiese con el plural. Una carga malformada podía provocar excepción.

## Mecanismo implementado

- `src/core/editor/asset-drop.js`: contrato especializado y puro para serializar, leer, validar y resolver el arrastre de recursos. No modifica escena, proyecto ni preferencias.
- El emisor `ProjectPanel.vue` reutiliza el contrato y mantiene ambas MIME y la semántica de carpetas/multiselección.
- `script-drop.js` conserva sus funciones públicas y consulta el registro de scripts real.
- Campos de imagen e icono y destinos existentes del terreno validan por `kind` + `id` contra `allEntries(store.project)`; no confían en nombre o ruta del texto arrastrado.
- Los destinos singulares rechazan selección múltiple; la vegetación mantiene selección múltiple y filtra los recursos no pertinentes como antes.
- La resolución tras renombrar o mover se realiza por ID; los recursos borrados o de otro tipo no se asignan.

## Límites

El JSON MIME es una declaración del emisor, no una prueba criptográfica de origen. La autoridad de existencia y tipo es el registro actual del proyecto. No se importa automáticamente un archivo externo ni se modifica el esquema `.lfproj`. Las asociaciones del Inspector y los editores especializados aún **no están integradas de forma global**: G002 y G003.

## Integración y verificación

El código no crea nodos ni invoca `commit`; el receptor conserva su operación original y su Undo/Redo. Ver `docs/qa/LF-ASSETS-SLOT-DND-S01-G001_QA.md`.

El siguiente Gate depende de esta interfaz, pero debe auditar cada formato de propiedad antes de escribir referencias.
