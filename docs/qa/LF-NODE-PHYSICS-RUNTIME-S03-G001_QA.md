# LF-NODE-PHYSICS-RUNTIME-S03-G001 — Evidencia y QA

**Fecha:** 2026-10-28. **Estado:** implementación entregable; QA local y aprobación pendientes.

## Evidencia automatizada

| Alcance | Resultado | Limitación |
|---|---|---|
| ZIP de entrada S02 | 920 archivos, integridad ZIP PASS | No reemplazar por ECS |
| Planificación del árbol S03 | PASS | Tests Node sin dependencias |
| Composición, offset, creación y liberación | PASS con dobles Jolt/Three | No demuestra WASM real |
| Regresión Node completa (100 archivos seleccionados) | **2.153 PASS, 0 FAIL, 19 SKIP** | Familias starcat/clouds excluidas |
| Editor, Player, build Vite, Jolt WASM | **NO VERIFICADOS** | node_modules ausente; npm EAI_AGAIN |
| Event Order Flow | `play-controls.js` byte idéntico | QA de eventos en Player pendiente |

## Escena de prueba obligatoria en LevelForge

1. Crear Node3D raíz. Añadir un StaticBody3D con MeshInstance3D/Primitive visual hija y CollisionShape3D Box como hija directa. No usar `collision` en la malla.
2. Añadir un RigidBody3D con una malla visual hija y una CollisionShape3D Box hija directa. Configurar masa 3, gravedad 1, fricción 0.6, restitución 0.1, amortiguación 0.05.
3. Añadir un cubo visual aislado sin ningún cuerpo físico.
4. En PlayMode, comprobar que RigidBody3D cae y se detiene sobre StaticBody3D; el cubo visual no detiene al jugador ni al rigid body. Verificar que los gizmos de las CollisionShape3D no se dibujan.
5. Añadir una segunda CollisionShape3D desplazada y rotada bajo el mismo cuerpo. Comprobar que se comporta como **un** cuerpo, no como dos cuerpos independientes.
6. Deshabilitar una forma y comprobar que deja de colisionar; deshabilitar todas y comprobar el aviso de cuerpo sin forma, sin inventar una colisión.
7. Cambiar Box por Sphere y Capsule, comprobar volumen, radio y altura real de colisión.
8. Pausar, reanudar, cambiar de escena y detener el juego. Comprobar que ningún cuerpo duplicado o huérfano persiste al regresar.
9. Probar raycasts y jugador, interacción de eventos, gráficos de páginas y objetos Database con física. Conservar orden de `fixedUpdate → jugador → _events → _bodiesTick → lateUpdate`.
10. Compilar `npm run build`, ejecutar `npm run electron` y exportar Player. Repetir pruebas 4–9 allí; no declarar PASS sin evidencia.

## Verificaciones recomendadas

```bash
cd ~/ENGINES/lf-0.26.13/lf
node --test scripts/test-node-physics-runtime-s03-g001.mjs scripts/test-node-physics-s02-g001.mjs scripts/test-node-core-s01-g001.mjs
npm run build
npm run electron
```

**Nota de alcance:** La física automática de primitivas antiguas fue sustituida deliberadamente. Los perfiles de física explícitos de Event y GameplayObject continúan usando sus interfaces especializadas. `CharacterBody3D`, `Area3D` y script por nodo corresponden a sprints futuros.
