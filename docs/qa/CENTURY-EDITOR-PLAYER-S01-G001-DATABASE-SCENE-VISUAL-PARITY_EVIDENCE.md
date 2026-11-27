# Century Engine — Database/Jugador y escena: paridad visual

**Gate:** `CENTURY-EDITOR-PLAYER-S01-G001-DATABASE-SCENE-VISUAL-PARITY`

**Autorización:** `Listo. CENTURY-EDITOR-PLAYER-S01-G001-DATABASE-SCENE-VISUAL-PARITY autoriza comenzar`.

**Origen:** SOURCE_BASELINE del Gate `CENTURY-EDITOR-CONSOLE-S01-G001-POINTER-AND-TERRAIN-RUNTIME-ERRORS`.

**Estado:** IMPLEMENTADO · TEST PASS dirigido · NO COMPILADO · QA LOCAL NO VERIFICADO · PENDIENTE DE APROBACIÓN Y CIERRE.

## Hallazgo acreditado

- `PlayerPreview.vue` centra la cápsula a la mitad de su altura y sitúa los ojos desde los pies.
- `jolt-character.js` construye `CharacterVirtual` con traslación vertical `height/2`; `CharacterBody3D` representa el origen de los pies.
- `nodes/physics.js` dibujaba la `CapsuleShape3D` alrededor del origen local del hijo sin aplicar esa referencia. La cámara se muestra como hija del cuerpo en su altura local de autoría.
- En Play, `play-player.js` configura la cápsula y la cámara del jugador designado a partir de Database. El Editor no aplicaba esa configuración a sus auxiliares.

## Cambio aplicado

- Las cápsulas bajo `CharacterBody3D` se dibujan con su centro a `height/2`, sin modificar la posición persistida del nodo ni la geometría física Jolt.
- Solo el jugador designado para la escena recibe dimensiones de Database en el contorno editorial; `CharacterBody3D` ajenos conservan medidas de sus recursos.
- La cámara directa elegida para el jugador muestra en el Editor `eyeHeight`, FOV y una guía compacta; conserva sus coordenadas laterales, rotación, jerarquía y descriptores originales. Los demás nodos de cámara no cambian.
- Cambios de Database, de identidad del jugador y de escena regeneran la representación editorial correspondiente. Al perder la identidad se restauran las medidas de autoría; en modo de aparición por API no se atribuye una identidad ficticia.
- No hay cambios en el contrato de Play, en Jolt, ni persistencia implícita de transformaciones editoriales. Los slots conservan su configuración y las referencias relativas a la cámara, sin introducir un segundo subsistema.
- No se añadieron comentarios de historial, Gates o Sprints al código.

## Pruebas y resultados

| Comando | Resultado |
|---|---|
| `node scripts/qa-suite.mjs editor-player-visual-parity` | 11/11 PASS |
| `node scripts/qa-suite.mjs editor-gizmos` | 55/55 PASS |
| `node --test scripts/test-player-scene-visual-parity.mjs scripts/test-fps-native-player-s16-g007-g003-g002-database-native-config.mjs scripts/test-fps-native-player-s16-g007-g002-g001-scene-player-identity.mjs scripts/test-physics-gizmo-s01-g001.mjs scripts/test-fps-native-player-s16-g007-g001-template-prefab.mjs scripts/test-fps-native-player-s16-g005-camera3d-orchestration.mjs` | 74/76 PASS; 2 fallos preexistentes acreditados en baseline |
| `node scripts/qa-suite.mjs smoke` | 29/30 PASS; defecto smoke preexistente |
| `npm run build` | BLOQUEADO: `vite: not found` (`node_modules` ausente) |
| QA Electron/Play con Jolt | NO VERIFICADO |

Los dos fallos existentes son la expectativa textual `mc.node.updateMatrixWorld(true)` en una prueba antigua de cámaras y la evaluación de `playerMethods` sin inyectar `crouchMethods` en una prueba antigua de Database. Ambos se reproducen sin aplicar este Gate. No se corrigieron tests ajenos al alcance.

## QA pendiente en Electron

- Cambiar altura, radio, altura de ojos y FOV en Database/Jugador; contrastar con los nodos designados en escena.
- Confirmar orientación -Z y jerarquías con padres trasladados y rotados.
- Comprobar cámaras, colliders de otros cuerpos y visibilidad de los gizmos por categoría.
- Entrar/salir de Play para verificar la cápsula Jolt, cámara activa, viewmodel y restauración de la vista editorial.
- Verificar que guardar y reabrir no escriba automáticamente las dimensiones de Database sobre el recurso de colisión ni la posición de la cámara.

Los archivos de evidencia y las capturas previas están en `docs/qa/evidence/CENTURY-EDITOR-PLAYER-S01-G001/`.
