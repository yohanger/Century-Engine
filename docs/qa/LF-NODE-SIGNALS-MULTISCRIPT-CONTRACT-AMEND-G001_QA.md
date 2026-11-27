# LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001 — QA documental

**Fecha:** 2026-11-02  
**SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_EDITOR_S06_G004_QA_APPROVAL_SOURCE_BASELINE(1).zip`.  
**Estado:** AUDITORÍA + AMENDMENT DOCUMENTADOS · QA CONTRACTUAL DEL USUARIO PENDIENTE · NO CERRADO.

## Matriz de comprobación

| ID | Exigencia documental | Soporte / Estado |
|---|---|---|
| CA-01 | Inspección del SOURCE_BASELINE correcto y comparación contra audit viejo | G004 1.533 archivos / audit anterior 1.479; íntegros, no fusionados · PASS |
| CA-02 | Registrar evidencia UI de `SM_Acera` y origen del catálogo vacío | Captura 2026-11-02, `SignalConnectionsPanel.vue` · DOCUMENTADO |
| CA-03 | Revisión técnica del slot único | `Inspector.vue`, `SceneTree.vue`, `node-scripts.js`, `node-lifecycle.js` · DOCUMENTADO |
| CA-04 | Detectar contratos supersedidos sin borrar decisiones históricas | Amendment §1 con referencias S05, S02, S04 y S06 · DOCUMENTADO |
| CA-05 | Contrato de panel Signals tipo Godot con lista sin conexiones y selección por árbol | Amendment §2 / guía oficial de Godot · DOCUMENTADO |
| CA-06 | Catálogo por nodo sin señales ficticias | Amendment §3 con revisión de registry/base y advertencia sobre ready/_ready · DOCUMENTADO |
| CA-07 | Multiscript por nodo, migración, aislación, orden, colisiones y limpieza | Amendment §4 · DOCUMENTADO |
| CA-08 | Quitar pestaña Terreno sin eliminar sus herramientas ni duplicarlas | Amendment §5 / `TerrainPanel.vue` · DOCUMENTADO |
| CA-09 | Extender antes de duplicar, APIs/escenas y Player/QA Electron como prerequisitos de código | Amendment §6 · DOCUMENTADO |
| CA-10 | No tocar producción ni crear scripts/runners en este Gate | Diferencia binaria entre SOURCE_BASELINE y nueva entrega: comprobar antes de cerrar · PENDIENTE DE VALIDACIÓN DE ZIP |
| CA-11 | Ledger sin pérdida de historial y seis hojas | ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY · ACTUALIZADO Y VERIFICADO: seis hojas, doce tablas, 31 partes XLSX, CRC PASS |
| CA-12 | Registrar distinción de estados | G004 anterior conserva QA LOCAL PASS/APROBADO; Amendment no implementa features; build/Electron antiguos siguen NO VERIFICADOS · DOCUMENTADO |

## No se han realizado pruebas de producción

Este Gate solo es documental. No se declara `TEST NODE PASS`, `COMPILADO`, `ELECTRON PASS`, `QA VISUAL PASS` ni nuevas funcionalidades implementadas. La evidencia 238/238 de G004 se conserva como **histórica del SOURCE_BASELINE**, no demuestra multiscript ni las nuevas señales. Si el usuario aprueba esta auditoría, se registrará QA CONTRACTUAL PASS declarado por él y, solo después, se podrá declarar el primer Gate de implementación.

## Evidencia local que exigirán los futuros Gates

- **Multiscript:** un nodo con 3 scripts, cada `_ready` en orden, estado privado y callbacks solo existentes; dos scripts del mismo nombre de método/señal producen error definido; eliminar uno limpia sus listeners sin afectar otros; guardar/duplicar/Prefab/Player conserva orden; proyecto antiguo con `scriptId` funciona y no pierde sus scripts.
- **Signals nativas:** nodo StaticBody3D y Area3D muestran señales reales según su capacidad, Node común cuando esté implementado; emisión con payload real y orden correcto; sin señal falsa; conexiones visuales a `_ready` no retroactivas; Play/Stop y Jolt real.
- **UX/Terreno:** abrir pestaña Señales, inspeccionar señales no conectadas, doble clic/Enter, seleccionar receptor en árbol, conectar/editar/desconectar y abrir script de destino, teclado/dock estrecho, múltiples scripts en el Inspector, Terreno contextual sin pérdida de herramientas; captura de Electron + validación local del usuario.

## Criterios de entrega

Exactamente 2 ZIP: CHANGE (solo documentos y ledger afectados) y SOURCE_BASELINE completo acumulado con los 1.533 archivos anteriores intactos salvo documentación/ledger. Ningún SHA-256 separado ni `.sh`. Comparación de archivos nuevos/modificados/eliminados, ZIP CRC, ledger de seis hojas y conservación de 12 tablas. Registrar los estados reales: PENDIENTE QA contractual, NO CERRADO.

## Aprobación contractual y continuidad (2026-11-02)

El usuario respondió «Me parece bien. [...] Dame el primer sprint» tras conocer el resumen del Contract Amendment y posteriormente autorizó literalmente `LF-NODE-MULTISCRIPT-S01-G001`. Se registra **QA CONTRACTUAL PASS DECLARADO POR USUARIO · APROBADO** para el Amendment como dirección vinculante. Este hecho no acredita QA local, compilación ni Electron del runtime multiscript G001.
