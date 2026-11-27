# QA — LF-ASSETS-SLOT-DND-S01-G001

**Gate:** autorizado. **Estado:** implementación entregable; QA local pendiente.
**Baseline de entrada:** `LevelForge_VCS_DOCS_G001_SOURCE_BASELINE.zip`.

## Cobertura automatizada

- `npm run test:assets-slot-dnd`: 26 pruebas de estructura MIME, legacy, rechazo de corruptos, ambigüedad, existencia por ID, compatibilidad de tipo, multiselección, carpetas y ausencia de mutación.
- `scripts/test-node-script-s05-corr001.mjs`: confirma asociación de Script de Nodo mediante el receptor existente.
- `scripts/test-editor-assets-s03-g001.mjs` y pruebas de paquete `.levelpackage`: cobertura de flujo de Assets.

## Pendiente de QA local

1. Desde Assets, arrastrar script de nodo a un objeto: funciona; Script Global se rechaza.
2. Arrastrar textura a imagen/icono y a capa de terreno; comprobar valor y Undo/Redo del destino.
3. Arrastrar varios modelos y texturas a vegetación; los demás recursos no se asignan.
4. Mover recursos entre carpetas y arrastrar nodos a Assets para prefab: sin regresiones.
5. Renombrar/mover y repetir arrastre: referencia estable por ID; borrar el recurso y comprobar rechazo.
6. Guardar `.lfproj`, reabrir, confirmar persistencia y ausencia de nuevos nodos inesperados.
7. Ejecutar build Editor/Player y abrir Electron; verificar estados de Drop manualmente.

## Estados

TEST AUTOMATIZADO PASS se limita a las pruebas ejecutadas. Build, Electron, operaciones de interfaz, persistencia real y QA de Player son **NO VERIFICADOS** hasta la evidencia del usuario. G002/G003 son PENDIENTE PLANIFICADO; no afirmar que todos los slots aceptan Drop.
