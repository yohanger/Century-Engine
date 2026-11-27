# QA — Sincronización de historial y SceneGraph

Estado: implementado en fuentes; no aprobado ni cerrado.

| Verificación | Resultado |
|---|---|
| QA local previo comunicado por el usuario | Undo/Redo Node 17/17; TOML 1/1; 67/78 checks Electron superados antes de la excepción |
| Siete pruebas focales antes de corregir | 1 PASS, 6 FAIL, incluida la misma excepción de `geometry` |
| Siete pruebas focales después de corregir | 7/7 PASS |
| Undo/Redo y sensibilidad | 17/17 PASS |
| Integridad numérica | 10/10 PASS |
| 15 suites de regresión antes y después | 138 PASS, 36 FAIL preexistentes, 1 omitida de 175; mismos nombres de fallos |
| Sintaxis de módulos modificados y fixture | 6/6 PASS |
| QA Electron | Bloqueado antes de iniciar: Vite ausente, 0/82 checks ejecutados aquí |
| Persistencia TOML | Bloqueada: smol-toml ausente aquí; sin modificaciones de TOML |
| Build | Bloqueado: vite no encontrado |

Las pruebas focales ejecutan las funciones productivas mediante VM y registros de `PolyMesh.toJSON()`; simulan el despacho reactivo y las dependencias gráficas. No acreditan Three.js y Vue integrados en Electron. Los tests históricos se conservan sin modificaciones. No hay nuevas dependencias ni cambios del runtime. El fixture amplía el runner a 82 comprobaciones, sin eliminar ni debilitar las 78 existentes.

## Comandos de aceptación

- `npm run test:suite -- history-scene-graph-synchronization`
- `npm run test:suite -- undo-context-and-mouse-sensitivity`
- `npm run test:suite -- editor-mouse-sensitivity-config`
- `npm run test:suite -- undo-context-and-mouse-sensitivity-electron`
- `npm run build`

Validar especialmente la transición de Object Mode de primitiva a malla después del Undo de conversión. El refresco debe observar firmas concordantes con el estado lógico y un cuerpo de malla construido. Conservar la secuencia nativa de Ctrl+Z, Ctrl+Shift+Z y Ctrl+Y en Edit Mesh, así como las preferencias. No aprobar ni cerrar hasta QA local y decisión explícita del usuario.
