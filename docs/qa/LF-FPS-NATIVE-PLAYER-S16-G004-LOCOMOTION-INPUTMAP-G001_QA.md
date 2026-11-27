# QA — S16-G004 Locomoción nativa e Input Map

**Gate:** `LF-FPS-NATIVE-PLAYER-S16-G004-LOCOMOTION-INPUTMAP-G001`

## Evidencia automatizada

- Baseline de entrada: `LF_FPS_NATIVE_PLAYER_S16_G003_CORR001_NODE_OWNER_TYPED_API_SOURCE_BASELINE.zip`.
- Suite focal: `scripts/test-fps-native-player-s16-g004-locomotion-inputmap.mjs` → **12 PASS / 0 FAIL**.
- Regresión seleccionada (G004+G003+CORR001+Input): **46 PASS / 0 FAIL**, sin saltos (salida guardada en esta documentación de QA como cifras, no se fabrica QA visual).
- Validación de sintaxis del JS de locomoción y del test: **PASS**.
- Build Vite: **NO VERIFICADO**, falta Vite instalado en el entorno de auditoría.
- Jolt WASM real, Electron y NGM Runtime: **NO VERIFICADOS**.
- QA local usuario: **PENDIENTE**. No declarar Gate APROBADO ni CERRADO.

## Instalación y prueba local

Usar la raíz de `SOURCE_BASELINE` con `package.json` y dependencias instaladas.

```bash
npm ci
node --test scripts/test-fps-native-player-s16-g004-locomotion-inputmap.mjs scripts/test-fps-native-player-s16-g003-characterbody3d-api.mjs scripts/test-fps-native-player-s16-g003-corr001-node-owner-types.mjs scripts/test-input-mouse.mjs
npm run build
npm run electron
```

Para prueba visual, abrir una escena nueva o copia de proyecto. Crear suelo con cuerpo estático y colisión real, un `CharacterBody3D` activo con **CollisionShape3D directo** tipo cápsula y una malla hija visible. Crear un Script de Nodo de tipo Node, copiar el contenido de `scripts/fixtures/fps/s16-g004-locomotion-node.js` y adjuntarlo al `CharacterBody3D`. Evitar reproducir el FPS heredado si se quiere observar exclusivamente este nodo; no eliminar código legacy. Comprobar Input Map del proyecto para las seis acciones requeridas. Con ratón capturado o foco de Play, probar W/A/S/D, Shift y Space; reasignar una acción en Input Map y confirmar que el script continúa respondiendo.

**Lista de verificación de usuario:**

1. Camina con entrada hacia delante y hacia atrás y cambia de dirección según la rotación del nodo.
2. Corre con `run` y deja de correr al soltar la acción.
3. Diagonal normalizada sin incremento de velocidad.
4. Acelera y frena progresivamente al presionar/soltar movimiento.
5. Salta una vez desde el suelo; no salta de nuevo en el aire por mantener Space.
6. No atraviesa suelo/obstáculos; gravedad y pendientes funcionan con Jolt real.
7. Dos personajes que comparten el script conservan estado de salto independiente.
8. Pausa/STOP/reinicio restauran la sesión; selección del Editor no condiciona Play.
9. Guardar/reabrir escena y repetir en **NGM Runtime** independiente con los mismos resultados.
10. Comprobar que la plantilla FPS heredada sigue funcionando sin regresión.

**Evidencia que debe devolver el usuario:** salida de Node y compilación, capturas o vídeo de Editor/NGM Runtime, y `game.log`/consola si algún caso falla. Ningún resultado no ejecutado equivale a PASS.

## Estado

- IMPLEMENTADO: script reutilizable y fixture, sin cambios en runtime.
- TEST AUTOMATIZADO: PASS focal 12/12 y regresión 46/46.
- COMPILADO: NO VERIFICADO.
- QA LOCAL: NO VERIFICADO.
- APROBADO / CERRADO: PENDIENTE.
