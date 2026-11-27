# QA — LF-NODE-CHARACTER-AREA-S04-G001

**Estado de entrega: IMPLEMENTADO PARCIALMENTE / GATE BLOQUEADO PARA CIERRE.** No supone QA físico real aprobado.

## Automatización 2026-10-28

- `node --test scripts/test-node-character-area-s04-g001.mjs`: **28 PASS / 0 FAIL / 0 SKIP**. Plan de nodos, jerarquía, shape del personaje, áreas múltiples, doble CharacterVirtual, velocidad independiente, notificaciones enter/exit sin duplicar, áreas desactivadas, liberación y regresión de flujo de física.
- Regresión seleccionada con `scripts/test-*.mjs` exceptuando `test-starcat*` y `test-clouds*`: **2181 PASS / 0 FAIL / 19 SKIP** en 101 archivos de pruebas. Pruebas de Node S01, Physics S02 y Physics Runtime S03: 116 PASS, 0 FAIL, 1 SKIP.
- Compilación Vite: NO VERIFICADA (`node_modules` no disponible).
- Jolt WASM real, `CharacterVirtual` múltiple, Area3D frente a cuerpos, Editor Electron y Player exportado: **NO VERIFICADOS**. Los dobles no prueban llamadas reales a Emscripten ni interacción visual.

## Bloqueos / incidencias pendientes

1. **BLOQUEO S04-01:** el bucle actual omite `JoltWorld.step` si no hay jugador FPS ni cuerpos dinámicos. Si la escena contiene solo CharacterBody3D y Area3D, las notificaciones/movimiento pueden no avanzar. Requiere Gate de excepción acotada en coordinación física protegida, no autoriza reescribir eventos.
2. **S04-02:** detección de pared/techo simplificada; validar contactos Jolt reales y pendientes, escalones, plataformas.
3. **S04-03:** falta probar en runtime real disponibilidad de `BodyInterface.GetWorldTransform` y el comportamiento de `CollideShape` en la versión JS del proyecto.
4. **S04-04:** los eventos de Área se exponen mediante callback interno; conexión al Script de nodo S05.

## QA local solicitado

- Crear `CharacterBody3D` con **una** `CollisionShape3D` Capsule centrada; comprobar movimiento horizontal, gravedad, suelo, pendientes y escalones, y dos personajes distintos.
- Crear `Area3D` con Box/Sphere/Capsule bajo el mismo nodo; comprobar `monitoring` y `monitorable`, entrada/salida de cuerpos y otras áreas, sin colisión sólida.
- Crear escena solo CharacterBody3D/Area3D **sin Player**: caso conocido bloqueado, no dar PASS sin corrección.
- Comprobar reparenting inválido, guardar y reabrir, Undo/Redo, cambio de escena, pausa, Editor y exportado; ausencia de marcadores en Player.
- Ejecutar `npm run build`, `npm run electron` y pruebas manuales de Jolt real. Registrar resultados diferenciados de los dobles.

## Integridad

Fuente: `LevelForge_NODE_PHYSICS_RUNTIME_S03_G001_SOURCE_BASELINE.zip`. Eventos protegidos: comparación byte a byte obligatoria antes de empaquetar. ECS ausente. El único cambio al libro debe corresponder a nuevas entradas y estados reales de S04.
