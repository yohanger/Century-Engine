# LF-NODE-SIGNALS-GODOT-COMPARATIVE-AUDIT-S00-G001 — QA documental

**Fecha:** 2026-11-02. **Estado:** AUDITORÍA COMPLETADA · TEST NODE FOCAL 153/153 PASS · QA CONTRACTUAL USUARIO PENDIENTE · NO CERRADO.

## Verificaciones del Gate

| ID | Comprobación | Resultado |
|---|---|---|
| S00-01 | SOURCE_BASELINE Multiscript G003 íntegro, 1.554 archivos | PASS |
| S00-02 | Fuentes oficiales Godot 4.x para Signals, Object, Node, Area3D, audio, animación, Timer y custom | DOCUMENTADO |
| S00-03 | Clasificar diferencias OBSERVADO/INFERENCIA/NO VERIFICADO | PASS DOCUMENTAL |
| S00-04 | Revisar `InspectorDock.vue` y `SignalConnectionsPanel.vue` | PASS DOCUMENTAL |
| S00-05 | Identificar emisor real y contrato Area3D/Jolt | PASS DOCUMENTAL |
| S00-06 | Revisar `NodeLifecycle` y activación posterior a `_ready` | PASS DOCUMENTAL |
| S00-07 | Revisar custom signals y multiscript; propiedad compartida y conflictos | PASS DOCUMENTAL |
| S00-08 | Verificar schema, Undo/Redo, Prefabs, portapapeles, importación/exportación | PASS DOCUMENTAL |
| S00-09 | Clasificación por familias de nodos sin inventar heredados | PASS DOCUMENTAL |
| S00-10 | Producción sin cambio; dos ZIP, QA y ledger con seis hojas y 12 tablas | PASS (verificación de paquete final) |
| S00-11 | Pruebas Node de base sin mutación | 153/153 PASS |
| S00-12 | Electron y compilación en este Gate DOCUMENTAL | NO EJECUTADOS (no obligatorios) |
| S00-13 | QA contractual del usuario de la auditoría | PENDIENTE |

### Comando realizado (solo lectura de código)

```
node --test \
  scripts/test-node-custom-signals-s04-g001.mjs \
  scripts/test-node-area-signal-bridge-s05-g001.mjs \
  scripts/test-node-signals-editor-s06-g002.mjs \
  scripts/test-node-signals-editor-s06-g003.mjs \
  scripts/test-node-signals-editor-s06-g004.mjs \
  scripts/test-node-multiscript-s01-g001.mjs \
  scripts/test-node-multiscript-s01-g002.mjs \
  scripts/test-node-multiscript-s01-g003.mjs
```

**Resultado registrado:** 153 PASS; 0 FAIL; 0 SKIP. La batería comprueba regresiones existentes, **no** paridad visual Godot ni nuevas señales nativas. No se creó harness ni script nuevo en producción.

### QA local Multiscript G003 incorporado como antecedente, no como prueba S00

El usuario respondió «Aprobado» y adjuntó logs. Estos muestran 20/20 Node PASS, Electron E01 WebGL2/Jolt WASM 25 comprobaciones PASS, Electron E02 Vue/Inspector 15 comprobaciones PASS, `gen-docs --check` PASS y dos compilaciones Vite (Editor/Player) terminadas correctamente. Queda registrado como QA LOCAL PASS declarado por usuario y G003 APROBADO/CERRADO. La ruta local que aparece en los logs tiene nombre histórico de baseline S06, por lo que los logs no verifican por sí solos el nombre de carpeta ni el checksum del SOURCE_BASELINE G003; el QA aprobado por usuario sí se preserva.

### Restricciones y aceptación por usuario

Verificar que la matriz no prometa señales inexistentes, identifique el riesgo de fase `ready`, delimite payload de Area3D, excluya Deferred/One Shot/bind sin autorización y posponga limpieza de Consola. Tras el QA contractual y la respuesta «Aprobado» se podrá declarar el siguiente Gate. No exigir al usuario repetir pruebas de Multiscript ya aprobadas.

**Estado de entrega final:** el siguiente empaquetado de este Gate documentará los ZIP, la integridad del Excel y el diff exacto de archivos; no se registra ejecución Editor/Player en S00.

**Verificación de empaquetado S00:** 3 documentos nuevos, 2 archivos existentes modificados (QA de G003 y ledger), 0 archivos de producción tocados, 0 eliminados. Los dos ZIP se comprobaron mediante lectura y CRC antes de la entrega.
