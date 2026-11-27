# LF-TIMELINE-UNITY-REPLACEMENT-S10-G001 — Sustitución estructural inicial

**Autorización literal:** «Listo. LF-TIMELINE-UNITY-REPLACEMENT-S10-G001 autoriza comenzar» (2026-11-06).
**Baseline de entrada:** `LF_FILMMAKER_NLE_DIRECT_AUTHORING_S01_G001_INTEGRAL_CORR004_SOURCE_BASELINE.zip` (acumulativo). Las versiones de `src/components/TimelinePanel.vue` y `src/core/timeline/model.js` son idénticas por SHA-256 a S09 enviado anteriormente. Esto NO autoriza modificar Nether FilmMaker.
**Referencia de interfaz:** paquete aportado por el usuario `com.unity.timeline-master.zip` (Unity Timeline 1.8.13); documentación e interfaz utilizadas como referencia. Código, imágenes, iconos y hojas USS de Unity NO incorporados.
**Estado:** IMPLEMENTADO EN FUENTES · TEST AUTOMATIZADO PARCIAL PASS · COMPILADO NO VERIFICADO · QA LOCAL PENDIENTE · GATE NO CERRADO.

## Objetivo y mecanismo

El usuario solicita sustituir la experiencia visual de la Timeline actual para acercarla a Unity Timeline manteniendo el modelo y runtime real de LevelForge. El primer Gate autorizado es de **sustitución estructural y operativa inicial**, no incorpora en bloque Mix/Ripple/Replace ni lógica de clips Unity C#.

Se extiende el componente ORIGINAL `src/components/TimelinePanel.vue`. Se conserva `src/core/timeline/model.js`, `src/core/timeline/preview.js`, el runtime de `src/engine/runtime/timeline/`, la identidad de recursos y la integración con `selectTemporal()` del Inspector. **No se crea una segunda Timeline ni se borra el modelo anterior**.

## Modificaciones implementadas

1. Encabezado compacto nativo, selector de recurso Timeline siempre visible incluso sin recurso abierto, acceso a crear Timeline y controles de transporte de alta densidad.
2. Estado **Vista previa** conectado al booleano original `previewOn`; navegación temporal por intervalos Snap mediante `stepTime()`, sin introducir otro reloj. Se conservan reproducir, detener, zoom y opciones.
3. Menú **+ Pista** reubicado en cabecera de pistas. Se conservan el popup via Teleport, los tipos reales de pista y los comandos meteorológicos de S09.
4. Cabeceras de pistas con iconos del propio LevelForge; silencio (`muted`) mediante `toggleTrackMute()` con commit y registro en historial. La etiqueta de candado solamente se dibuja en pistas `bake`, que ya son de solo lectura; no existe bloqueo de pistas editable inventado.
5. Segmentos entre claves de cámara/nodo presentados como bloques temporales seleccionables. Seleccionar un segmento selecciona su clave inicial; no se crea ni persiste un tipo `clip` nuevo. Se conservan las asas reales de ajuste de segmento de S09, cabezal, claves y comportamiento `nearest`.
6. Regla, grid principal/secundario, cabeceras y estados visuales rediseñados dentro del componente, con diseño responsive, foco visible y barra de estado vinculada a datos reales.

## Dependencias y límites

- El paquete Unity original no se ejecuta: su implementación depende de UnityEditor/UnityEngine/PlayableDirector (C#), incompatibles con Electron/Vue.
- Los recursos visuales utilizados son CSS e iconos existentes de LevelForge; no se han incorporado PNG/USS/C# de Unity.
- No se modifican `NleTimeline.vue`, FilmMaker, grabación móvil, Player, modelos, persistencia, editor de eventos, física o sistema de Cinematics.
- Mix/Ripple/Replace, editor de curvas avanzado, grupos de pistas y selección múltiple general permanecen PENDIENTE PLANIFICADO; implementarlos exige Gate posterior que detalle el cambio semántico.
- La equivalencia visual exacta con Unity 1.8.13 NO está demostrada por QA visual. La primera fase tampoco supone paridad total de herramientas.

## Evidencia

Ver `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_QA.md`. QA local en Electron sigue siendo obligatorio; una compilación no valida experiencia visual, docking o rendimiento.
