# LevelForge — LF-WATER-S03-G001 — QA / Entrega

**Fecha:** 2026-10-25  
**Autorización exacta:** `Listo. LF-WATER-S03-G001 autoriza comenzar`  
**Estado:** IMPLEMENTADO EN FUENTE · TEST AUTOMATIZADO PARCIAL · BUILD/QA VISUAL PENDIENTES  
**Fuente:** `LevelForge_WATER_S02_G001_SOURCE_BASELINE.zip` (697 entradas, ZIP validado).

## Objetivo

La superficie visible de agua física y las consultas del juego leen la única autoridad `WaterWorld` aprobada en S01/S02. No se sustituye el solver, ni se simulan gotas físicas individuales, ni se migra automáticamente el agua de escenas anteriores. Los proyectos sin `environment.waterSimulation.enabled` mantienen su ruta visual y física anterior.

## Cambios concretos

- **W19–W20:** `geometry/water-surface.js` representa celdas con profundidad física mayor de 2 mm mediante geometría dinámica `BufferGeometry` y `MeshStandardMaterial` PBR. No escribe en el estado de WaterRegion. Celdas sin suelo, secas y regiones retiradas no generan superficie visible. Se suaviza la continuidad en las esquinas compartidas de las celdas contiguas; resolución efectiva depende de la rejilla física.
- **W21:** `render/wetlib.js` conserva la humedad y el tratamiento de nieve existentes. Dentro de la huella de una región física suprime los charcos inventados por el shader procedural; fuera de esas regiones mantiene el comportamiento previo. Máximo de 32 regiones visuales por escena (además del límite previo de 4096 celdas físicas).
- **W22:** `geometry/watershader.js` reutiliza el shader PBR existente en modalidad simulada: profundidad visual de la celda en lugar del mapa estático heredado; desactivación de la perturbación de altura de olas grandes para que no se desincronice la superficie física; conservación de ondas de interacción en normales y espuma. Los materiales de cuerpos anteriores conservan su ruta (`simulated = false`).
- **W23–W25:** sin crear otra flotabilidad ni rutas de consulta. El jugador FPS, cuerpos Jolt y API `game.water` ya consumen `WaterWorld.at()`, que en S01/S02 ofrece `surface`, `depth`, `flowX`, `flowZ`. Las pruebas comprueban esa relación. No se implementan nuevos estados de gameplay.
- **W26:** `SceneGraph` prepara una vista previa inicial en Edit Mode sin avanzar `WaterWorld.step`; `PlayMode` publica a la malla el estado simulado a intervalos de 0,1 s, y libera geometrías y materiales al desmontar la escena. La interfaz «Agua física» está dentro del panel Terreno para activar/desactivar una región inicial y editar su profundidad inicial. Se conserva la configuración avanzada por `environment.waterSimulation.regions` para múltiples piezas.
- Se comprueba el solapamiento espacial con cuerpos de agua anteriores al crear una **conexión de escena**, no en `WaterWorld.addRegion` (para conservar la API ya aprobada de S01).

## Prerrequisitos del usuario

1. Guardar los ZIP en `$HOME/Downloads` y verificar que no existen cambios locales nuevos en archivos del CHANGE. El asistente no puede inspeccionar el disco de la instalación del usuario.
2. Descomprimir **solo** CHANGE en el proyecto activo; conservar el SOURCE_BASELINE completo como referencia de continuidad.
3. Desde `~/ENGINES/lf-0.26.13/lf`:

```bash
node --test scripts/test-water-s03.mjs
node --test scripts/test-water-s02.mjs scripts/test-water-s01.mjs
node --test scripts/test-render-pipe-s01.mjs scripts/test-audio-s01.mjs scripts/test-audio-s02.mjs scripts/test-audio-s02-corr001.mjs scripts/test-db-contract.mjs scripts/test-three-s01.mjs
npm run build
npm run electron
```

## QA manual — no atribuir PASS antes de ejecutar

1. En Edit Mode seleccionar **Terreno → Agua física**, activar simulación; aparecerá una región inicial 32×32 sobre la pieza seleccionada. La profundidad inicial 0 no muestra charco hasta que exista agua.
2. Establecer profundidad inicial **0,15 m**; comprobar previsualización PBR y que el solver no avanza mientras se edita. Mover la cámara, editar el relieve y confirmar actualización.
3. Entrar en Play Mode: el agua debe ser visible a la altura correspondiente al estado físico, sin aparecer una segunda lámina. Comprobar sin lluvia, con lluvia, con obstáculos y en depresiones.
4. Apagar la simulación: los proyectos anteriores recuperan el charco procedural y los cuerpos Water mantienen sus olas.
5. Confirmar que un terreno seco o un hueco entre terrenos no genera agua visible.
6. Verificar vadeo/natación solo cuando la profundidad real y la posición del jugador lo permiten; probar arrastre de un objeto flotante con Jolt y `game.water.at(x,z)`.
7. Cambiar de escena, regresar a Edit Mode y guardar/cargar configuración de escena; no deben quedar superficies ni recursos residuales.
8. Exportar Player y verificar paridad visual y de gameplay; no se deben mostrar ayudas del editor.
9. Supervisar uso de CPU/GPU en hardware modesto, sin atribuir mejoras no medidas.

## Evidencia local de elaboración

- `node --check` de los JS afectados: PASS.
- `node --test` de suites Water S01/S02/S03, render, audio, Database y Three S01: **497 PASS, 0 FAIL, 9 SKIP** (12 nuevas pruebas específicas de S03). Los 9 SKIP requieren dependencias Three.js que no están en el entorno del asistente.
- `npm run build`: **NO VERIFICADO**, retorna `vite: not found` (código 127). **No equivale a compilación PASS.**
- No se han realizado pruebas auditivas, render WebGL real ni pruebas del Player exportado.

## Exclusiones

Persistencia del estado dinámico durante partidas, reconstrucción de Film Maker, optimización regional avanzada y simulación volumétrica 3D corresponden a S04 o planes posteriores. No se incorporan FLOW/FrostEngine ni dependencias nuevas.

## Riesgos conocidos

- La superficie utiliza la resolución de las celdas físicas; en rejillas grandes y gruesas, las orillas pueden verse escalonadas. El suavizado visual no modifica las profundidades físicas.
- La vista previa en Edit Mode utiliza la profundidad inicial; no hace avanzar lluvia ni simula trayectorias del tiempo.
- El shader necesita compilación WebGL real en la instalación para confirmar la compatibilidad de uniformes, incluida la tarjeta gráfica integrada.
- Un cuerpo Water legado y una región física no se deben superponer en la misma huella; el enlace de escena emite error si detecta la coincidencia en una celda muestreada.
- Las fuentes de agua menores de 2 mm de profundidad física pueden seguir siendo detectables por las consultas aunque no se dibujen, para evitar ruido visual.

## Entrega

**Solo dos ZIP:** `LF-WATER-S03-G001_CHANGE.zip` y `LevelForge_WATER_S03_G001_SOURCE_BASELINE.zip`. Diferencias exactas y conteos incluidos en el mensaje de entrega. El segundo es acumulativo e incluye los Sprints y Gates anteriores sin `node_modules`, `dist`, logs, cachés, ni builds.
