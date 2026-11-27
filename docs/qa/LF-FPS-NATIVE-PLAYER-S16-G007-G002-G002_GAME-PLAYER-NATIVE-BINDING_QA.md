# S16-G007-G002-G002 — QA local del vínculo nativo game.player

**Estado:** PENDIENTE DEL USUARIO. Ninguna de las comprobaciones siguientes se considera PASS por anticipado.

## Preparación

1. Extraer el SOURCE_BASELINE en una carpeta nueva y conservar G007-G002-G001. Nunca mezclar SOURCE_BASELINE y CHANGE en la misma carpeta.
2. Desde la raíz que contiene `package.json`, instalar `npm ci` (red si es necesaria), ejecutar:

   - `node --test scripts/test-fps-native-player-s16-g007-g002-g002-game-player-binding.mjs`
   - `node --test scripts/test-fps-native-player-s16-g007-g002-g001-scene-player-identity.mjs scripts/test-fps-native-player-s16-g007-g001-template-prefab.mjs scripts/test-fps-native-player-s16-g006-native-interaction.mjs scripts/test-fps-native-player-s16-g005-camera3d-orchestration.mjs scripts/test-fps-native-player-s16-g004-locomotion-inputmap.mjs scripts/test-fps-native-player-s16-g003-characterbody3d-api.mjs scripts/test-fps-native-player-s16-g007-g002-g002-game-player-binding.mjs`
   - `npm run build`
   - `npm run electron`

Resultados Node de referencia: 18 y 101 pruebas PASS. El build debe ejecutarse localmente sin errores; no fue posible comprobarlo en este entorno.

## Aceptación de Editor

1. Crear una copia de un proyecto First Person. Arrastrar **Personaje FPS** desde Assets, con `CharacterBody3D`, `CollisionShape3D` y `Camera3D` hija.
2. En la configuración de escena, designar ese `CharacterBody3D` como personaje controlado. Iniciar Play. Debe existir **una sola autoridad física**: el nodo y su Jolt, nunca dos cápsulas moviéndose en paralelo.
3. Mover/saltar y consultar `game.player.position`, `game.player.velocity`, `game.player.grounded` con script ordinario. Deben corresponder al nodo real; alterar el nodo debe reflejarse sin estado espejo.
4. Probar teletransporte/ruta nativos y comprobar que la instancia y su colisión se trasladan juntas, sin desfase ni otra posición del FPS heredado.
5. Tener dos `CharacterBody3D`, uno designado. Sólo el designado es `game.player`; el segundo mantiene física y scripts independientes.
6. Guardar, cerrar y reabrir la escena. Alternar entre dos escenas, incluso con IDs de nodo repetidos si el fixture lo permite: las referencias viejas deben invalidarse.
7. Introducir `playerNodeId` inválido o desactivar el cuerpo: debe aparecer diagnóstico, **sin generar FPS de respaldo**. Probar también un GameManager `Sin jugador` y la ruta FilmMaker.
8. Abrir una escena heredada **sin `playerNodeId`** y verificar que el FPS antiguo sigue funcionando sin cambios.
9. Verificar Camera3D / Camera Orchestration, Timeline y Signals relevantes con el personaje nativo.
10. Exportar, ejecutar el **NGM Runtime** independientemente y repetir las comprobaciones esenciales.

## Registrar evidencia

Devolver: salida de las pruebas, build, funcionamiento real Electron y NGM Runtime; captura de jerarquía/identidad, vídeo opcional de movimiento y cambio de escena, `game.log`/errores si falla. Indicar explícitamente qué casos no se probaron. Una aprobación sin evidencia local no equivale a QA LOCAL PASS ni CERRADO.

## Funciones expresamente fuera de G002

Spawn Player como API de Prefab, integración Database/ViewModel completa, manos/slots y eliminación definitiva de `FpsPlayer` siguen en Gates posteriores. No certificar su paridad en este QA.
