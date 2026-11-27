# QA S15-G006 — Transiciones de cámara y políticas de salida

**Estado:** IMPLEMENTADO EN FUENTES · 28/28 Node PASS · 170/170 regresión seleccionada PASS · COMPILACIÓN/QA LOCAL/APPIMAGE NO VERIFICADOS.

## Prerrequisito

Aplicar CHANGE solo sobre el proyecto que ya contiene el SOURCE_BASELINE documental G006 y los Gates anteriores. Comparar cualquier cambio local antes de sobrescribir archivos. No eliminar `node_modules`, proyectos, Assets, escenas o Database. Ejecutar desde la raíz de LevelForge con `package.json`.

## Pruebas automatizadas

```bash
node --test scripts/test-camera-orchestration-s15-g006.mjs
node --test scripts/test-camera-orchestration-s15-g006.mjs scripts/test-camera-orchestration-s15-g005-corr001.mjs scripts/test-camera-orchestration-s15-g005.mjs scripts/test-camera-orchestration-s15-g002.mjs scripts/test-camera-orchestration-s15-g003.mjs scripts/test-cinematics-player-integration-s05-g004.mjs scripts/test-event-order.mjs scripts/test-node-active-visible-s15-g003-corr002-cont001.mjs scripts/test-game-manager-g001.mjs
npm run build
npm run electron
```

**Esperado de Node con dependencias presentes:** 28 PASS y 170 PASS respectivamente, cero FAIL. La prueba G006-25 utiliza JSZip real; si falta jszip en el entorno de ejecución se registra SKIP, que no debe confundirse con PASS. El resultado de `npm run build` debe contener los dos builds Editor y Player. No basta compilar para certificar render, input o Player independiente.

## Matriz de QA visual y runtime

1. Crear dos Camera3D activas, FOV y perfiles distintos; añadir evento «Controlar cámara» y comprobar Cut `seconds=0`.
2. Activar Camera3D con blend de 2 s `inOut`: continuidad de posición, orientación y FOV. Comparar con `linear`.
3. Mover el nodo Camera3D destino durante blend: el objetivo debe seguir su pose viva.
4. Cambiar otra vez con el mismo evento durante blend: partir de la vista efectiva; sin salto a cámara base o al origen anterior.
5. Desde otro evento o script con lease ajeno: adquisición rechazada; imagen, blend, perfil e input no cambian.
6. Liberar `keep` durante blend: debe terminar la transición y seguir la Camera3D móvil; liberación previa sigue inactiva.
7. Liberar a `base` con corte y blend. Solo entonces se permite volver a GameManager/main/FPS.
8. Liberar a `camera3d`, `previous`, `player` y `pose`, verificando requisitos y diferencias entre seguimiento vivo y pose fija. En plantilla Sin jugador, `player` no debe inventar FPS.
9. Seleccionar Camera3D inactiva/eliminada o escena incorrecta: rechazo de operación; si desaparece durante blend, fallback seguro y lease inválido.
10. Crear un Timeline nuevo desde Assets: Opciones de Timeline debe exponer salidas por motivo con `keep` predeterminado; guardar, cerrar, reabrir y conservar configuración.
11. Abrir un Timeline que ya existía antes de G006 y no tiene `cameraExit`: debe conservar su salida previa y mostrar «Comportamiento actual».
12. Timeline nuevo con Camera3D vinculada: probar fin natural, Stop y Skip con políticas distintas. No convertir `keep` en snapshot.
13. Timeline nuevo con solo pose libre: la falta de fuente viva se diagnostica; debe evitarse retorno automático al FPS. `pose` explícito conserva imagen fija.
14. Cambio de escena y destrucción del nodo: no reutilizar lease/snapshot; Camera3D de igual nombre o ID en otra escena no recibe control por error.
15. `lock=true` suspende movimiento y mirada y restaura ambos; `lock=false` no los bloquea por sí mismo. Revisar múltiples Timelines superpuestos.
16. Camera Shake y cámara solicitada: una sola composición. FilmMaker/Timeline no deben recibir Shake externo de forma implícita.
17. Preview editorial, gizmos y selección temporal de G005: sin regresiones; no se generan keyframes automáticos.
18. Verificar la misma escena en Editor Play Mode y **juego exportado ejecutado independientemente**; comprobar cámaras, perfiles y políticas, incluida plantilla Sin jugador.

**Nota:** `interrupted` se conserva como motivo declarable, pero no tiene emisor de evento de interrupción de Runner entre propietarios bajo el arbitraje actual; no registrar PASS de ese evento hasta que exista un consumidor autorizado. Se probarán las interrupciones del mismo lease durante blends.

## Evidencia a devolver

Salida de ambas órdenes Node, de `npm run build`, de `npm run electron`, capturas o video de Cut/Blend/Stop/Skip, confirmación de ejecución independiente de juego exportado y resultado por escenario PASS/FAIL/NO VERIFICADO. No cerrar G006 hasta tu aceptación y la evaluación de esta evidencia.

G007 (QA integral) permanece separado y no autorizado.
