# QA — LF-NODE-CHARACTER-AREA-S04-G001_CORR-001

**Fecha:** 2026-10-28  
**Entrada:** SOURCE_BASELINE S04 (929 archivos)  
**Estado:** CORRECCIÓN IMPLEMENTADA Y REGRESIÓN PASS; JOLT REAL / EDITOR / PLAYER PENDIENTES.

## Resultados automatizados ejecutados

- `node --test scripts/test-node-character-area-s04-corr001.mjs` → **13 PASS / 0 FAIL / 0 SKIP**.
- `node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat*' ! -name 'test-clouds*' | sort)` → **2194 PASS / 0 FAIL / 19 SKIP**; 102 archivos de prueba.
- Las regresiones S01–S04 están incluidas. Causas de SKIP: verificaciones opcionales del entorno; no son prueba de funcionamiento WASM real.
- La comparación final de archivos `events/` y de paquetes se verifica antes de entregar; se permite modificar solo `play-controls.js` y `play-bodies.js` dentro de eventos.

## Qué cubren las 13 pruebas

1. Escena sin FPS ni BodySet (CharacterBody3D/Area3D).
2. Escena solo con FPS.
3. Escena solo con cuerpos dinámicos.
4. FPS más cuerpos dinámicos.
5. `n=0`: cero pasos de física.
6. Jolt ausente: flujo de jugador y eventos sin excepción.
7. Pausa y avance manual de un fotograma.
8. Reanudación y acumulación fraccional de tiempo.
9. Film Maker: pasos de física a frecuencia fija sin jugador.
10. El controlador FPS ya no ejecuta `ph.step()`.
11. `_bodiesTick` ya no ejecuta física de respaldo.
12. `JoltWorld` mantiene `nodeSpatial.tick` y no usa bandera `stepped`.
13. Área y eventos conservan orden de actualización; no hay temporizador paralelo.

## QA local obligatorio

- `npm run build` (Editor + Player) y `npm run electron`: **NO VERIFICADO en este entorno** al faltar `node_modules`.
- Crear escena con **solo Area3D** y CollisionShape3D; verificar detecciones frente a un cuerpo que entra/sale y que la simulación se actualiza sin FPS.
- Crear escena con **solo CharacterBody3D** y suelo StaticBody3D, comprobar movimiento y contacto al paso fijo.
- Repetir con **FPS**, con **RigidBody3D**, y con ambos: confirmar ausencia de doble gravedad o velocidades duplicadas.
- Modificar tasa física; reproducir a FPS alto/bajo y verificar que el número de pasos corresponde al acumulador.
- Pausar, avanzar un paso y reanudar; comprobar que no se crean eventos de entrada/salida repetidos.
- Cambiar escena y detener Play: verificar liberación de cuerpos y sensores y ausencia de referencias colgantes.
- Ejecutar **juego exportado** y comprobar la misma cadencia y eventos que en Editor.
- Verificar Event Order Flow, páginas, comandos, señales, Player y Gameplay Objects.

**Nota:** la corrección de coordinación se implementó sin tocar algoritmos de contactos, pendientes/escalones ni filtros de sensores. Su funcionamiento real requiere Jolt WASM y pruebas manuales; no se declara S04 íntegramente aprobado por los tests con dobles.
