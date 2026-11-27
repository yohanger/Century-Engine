# QA de integración local — LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL

**Resultado actual:** fuentes integradas, Node 332 PASS / 13 SKIP / 0 FAIL, Vite/Electron/Player y QA visual **NO VERIFICADOS**. Aprobación y cierre **PENDIENTES**.

## Antes de aplicar

El CHANGE compara contra `LF_TIMELINE_UNITY_REPLACEMENT_S10_G005_INTEGRAL_CORR003_SOURCE_BASELINE.zip`. Revisar y respaldar modificaciones locales antes de sustituir archivos; nunca sobrescribir el proyecto real o escenas del usuario sin reconciliación. Si la base local es distinta, probar el SOURCE_BASELINE G006 completo **en una carpeta separada**. El directorio de trabajo es la raíz existente que contiene `package.json`.

## Comandos desde la raíz de LevelForge

```bash
npm ci
node --test scripts/test-timeline-unity-replacement-s10-g006-integral.mjs
node --test scripts/test-cinematics-player-integration-s05-g004.mjs
node --test scripts/test-runtime-persist-g001.mjs scripts/test-project-safe.mjs
npm run build
npm run electron -- --build
```

Se espera **16 PASS y 0 FAIL** en la suite específica si el compilador Vue está instalado; en este entorno dio **15 PASS / 1 SKIP**. El build deberá completar Editor y Player sin fallos, pero la compilación aislada **no** equivale a QA visual. No usar `npm audit fix` ni actualizar dependencias sin Gate.

## QA usuario en Electron y Player

1. **Dos cámaras:** crear dos pistas de Cámara en la misma Timeline, con Primera iniciando en `0s` y Segunda empezando en `4s`. A `1s`, Preview y Player deben usar Primera (no devolver la cámara normal); a `5s`, Segunda; al silenciar Segunda, Primera; al silenciar ambas, cámara del juego. Probar seek hacia delante/atrás, pausa y reanudación.
2. **Eventos de Comandos, Naturaleza, Audio y Método:** confirmar que se disparan una vez al alcanzar su tiempo, no se duplican durante pausa y se comportan según contrato ante seek, loop, skip y comando bloqueante. Las claves de pista distinta con ID coincidente se cubren automatizadamente; no alterar IDs del usuario para probarlo.
3. **Edición integrada:** Timeline y Inspector muestran el mismo recurso; modificar curvas, clips Mix/Ripple/Replace, duración de Audio, grupos, marcadores y bloqueo. Verificar que las operaciones protegidas no cambian el recurso y que Ctrl+Z/Ctrl+Mayús+Z restauran el estado cuando corresponda.
4. **Save/reopen:** crear proyecto de prueba, guardar, cerrar y reabrir. Verificar IDs, duración, clips, grupos, orden editorial, bloqueo, marcadores, tangentes y comandos; probar un recurso antiguo sin metadatos nuevos. No usar escenas de producción para ensayos destructivos.
5. **Interfaz Responsive First:** comprobar cabeceras fijas, scroll horizontal de toolbar, asas independientes, curvas adaptables y corchete `]` global de altura completa con zoom, scroll vertical/horizontal y dock estrecho/desacoplado.
6. **Runtime/Player:** reproducir la misma escena y comparar transiciones, poses, eventos y restauración del control del jugador al detener o terminar la Timeline. Guardar vídeo si difiere de Preview.
7. **Rendimiento (equipo local):** registrar FPS/tiempo de frame y memoria de Editor/Player con 1, 8 y 24 pistas y 10–80 claves por pista; anotar hardware, modo de render, resolución, si la vista de Curvas está abierta y diferencias. No se promete objetivo fijo sin mediciones.
8. **Exportación:** `npm run build` debe producir Editor/Player; ejecutar el Player mediante el método normal del proyecto y corroborar la misma escena. Cualquier exportación AppImage adicional se probará solo si forma parte del flujo local aprobado.

## Evidencia a devolver

Salida íntegra de comandos, imágenes/vídeos de cámaras a 1s/5s, resultado guardado/reapertura, evidencia de comportamiento de eventos, captura del `]` con scroll y métricas FPS/memoria. Informar PASS / FAIL / NO VERIFICADO por cada apartado; ante FAIL, incluir pasos, proyecto de prueba o log pertinente.

## Bloqueo contractual

Comandos/Naturaleza/Métodos continúan como eventos puntuales. G006 no los convierte en bloques de duración independiente; esa capacidad requiere Contract Amendment explícito si el usuario mantiene el requisito. No cerrar Sprint 10 sobre un pendiente contractual omitido.
