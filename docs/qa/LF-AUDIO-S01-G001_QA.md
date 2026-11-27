# LevelForge — LF-AUDIO-S01-G001 · Contrato de ejecución y QA

**Sprint:** estabilidad y evaluación del sistema de audio existente.  
**Estado:** IMPLEMENTADO EN FUENTE; TEST AUTOMATIZADO PASS; BUILD NO VERIFICADO; QA LOCAL PENDIENTE.  
**Autorización recibida:** `Listo. LF-AUDIO-S01-G001 autoriza comenzar` (2026-10-24).

## Fuente y límites

Fuente acumulada: `LevelForge_EDITOR_F12_G001_SOURCE_BASELINE(1).zip` → `LF-THREE-S01-G001_CHANGE.zip` → `LF-THREE-S01-G001_CORR-001_CHANGE.zip` → este Gate. No se tuvo acceso a modificaciones locales posteriores del usuario. Comparar antes de extraer CHANGE.

Se conserva Web Audio API, `AudioEngine`, `AudioScene`, buses, efectos, snapshots y API `game.audio`. Steam Audio sirvió únicamente como referencia conceptual: no se añadió código, SDK ni dependencias de Valve.

## A01 — Fundidos de parada: CORREGIDO EN FUENTE

**Observado:** `Voice.stop(fade)` programaba `BufferSource.stop` para el fin del fundido, pero llamaba inmediatamente a `_drop`; `_drop` desconectaba el grafo transcurridos 60 ms. Esto interrumpía fades más largos.

**Mecanismo aplicado:** `Voice.stop(fade)` mantiene conectada la fuente hasta recibir `onended` de Web Audio. Solo entonces se elimina la voz y se resuelve `done`. `isPlaying` pasa a false al solicitar la parada. Una nueva petición `stop(0)` durante un fundido lo cancela y libera inmediatamente, útil para cambios de escena. El comportamiento de `pause/resume`, `stopAll()` y la parada inmediata se conserva.

**No probado todavía:** calidad auditiva real del fade, suspensión del contexto y finalización real de Chromium/Electron.

## A02 — Efectos temporales: CORREGIDO EN FUENTE

**Observado:** `eff()` combinaba overrides (`override[g.id].fx`) solo para los efectos persistentes, y añadía `extra` sin aplicarles su configuración temporal. `effectOff()` encontraba el ID temporal, pero esa desactivación no llegaba al DSP.

**Mecanismo aplicado:** la misma función de resolución de overrides se aplica a `g.fx` y `override.extra`. No se duplica el mezclador ni se alteran los datos del proyecto. La cadena de efectos conserva su identidad; `effectOff` desactiva y `effect` reactiva mediante el mismo mecanismo.

## A03 — Reverberación: EVALUACIÓN, SIN OPTIMIZACIÓN AUTORIZADA

`audio/effects.js` reconstruye el buffer convolutivo cuando cambia la clave `time|damping` redondeada a dos decimales y el efecto está activo. `audio/impulse.js` crea dos canales Float32. Ejemplo teórico: reverberación de 6.5 s a 48 kHz ocupa al menos 2,496,000 bytes de muestras antes de costes extra. Una animación continua de duración/amortiguación puede producir asignaciones repetidas. No se han medido picos CPU ni glitches reales.

**Recomendación:** medir número de regeneraciones y tiempo por actualización en equipo local antes de considerar caché o reducción de frecuencia. No cambiar ahora la reverberación ni su sonido.

## A04 — Caché de audio: EVALUACIÓN, SIN POLÍTICA NUEVA

`AudioEngine.buffers` mantiene un Map con los `AudioBuffer` decodificados. `forget(id)` elimina referencias manualmente, pero no hay un presupuesto de memoria. Una pista PCM estéreo de 60 s a 48 kHz equivale teóricamente a 23,040,000 bytes de muestras, sin contar sobrecarga, buffers temporales o detalles de implementación. No se ha observado un problema real de memoria en Chromium.

**Recomendación:** medir memoria de clips decodificados, reutilización y liberación al cambiar proyectos; definir una política solo si los datos justifican el cambio.

## A05 — Voces simultáneas: EVALUACIÓN, SIN LÍMITE NUEVO

`AudioEngine.voices` es un Set sin prioridad, virtualización ni máximo explícito. `AudioScene.update()` sigue espacialmente a las fuentes activas por frame. El coste crece con la cantidad de voces, pero no se ha medido su impacto real.

**Recomendación:** benchmark en editor y Player con 8, 16 y 32 fuentes, HRTF activado y desactivado. Evaluar glitches, latencia, CPU, memoria y sonido antes de añadir límites. No introducir límites arbitrarios.

## Pruebas ejecutadas en el entorno de elaboración

| Comando | Resultado |
|---|---|
| `node --test scripts/test-audio-s01.mjs` | 11 PASS / 0 FAIL / 0 SKIP; Web Audio simulado |
| `node --test scripts/test-db-contract.mjs` | 408 PASS / 0 FAIL / 0 SKIP |
| `node --test scripts/test-three-s01.mjs` | 10 PASS / 0 FAIL / 1 SKIP; dependencias Three ausentes |
| `node --check src/engine/runtime/audio/engine.js` | PASS |
| `npm run build` | NO VERIFICADO: `vite: not found` (sin node_modules) |
| QA de escucha, Electron, Player exportado y AppImage | PENDIENTE del usuario |

**Nota:** la aprobación de compilación del usuario para S01 de Three.js es anterior a este Gate. No constituye evidencia de compilación de estas correcciones.

## QA local obligatorio

Tras comparar los cuatro archivos modificados/nuevos con tus archivos locales, extraer CHANGE sobre la raíz `lf/` y conservar el baseline anterior:

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
npm ci
node --test scripts/test-audio-s01.mjs
node --test scripts/test-db-contract.mjs
node --test scripts/test-three-s01.mjs
npm run build
npm run electron:dev
```

1. **Fade 2 s:** reproducir un sonido sostenido por `game.audio`, llamar `stop(2)` o `stopAll(null, 2)` y escuchar descenso continuo sin corte a los 60 ms. Repetir con 0 s.
2. **Cambio de escena durante fade:** detener inmediatamente una voz con fundido pendiente y comprobar que desaparezca sin sonidos residuales ni fugas.
3. **Pausa/reanudación:** comprobar que una fuente pausada no se pierde del mezclador y puede reanudarse.
4. **Efecto temporal:** `game.audio.effect('sfx','lowpass',{freq:800})` y `game.audio.effectOff('sfx','lowpass')`; verificar auditivamente que el filtro se desactive; activarlo nuevamente.
5. **Persistencia:** guardar/reabrir el proyecto y comprobar que los overrides de runtime no se guardan ni alteran el mezclador configurado.
6. **Editor/Player:** repetir reproducción y efectos en juego de prueba y juego exportado. Comparar el comportamiento y registrar errores de consola.
7. **Evaluaciones A03-A05:** si se desea medir en otro Sprint, entregar métricas antes/después de reverb, memoria y 8/16/32 voces. No hay optimización implementada en este Gate.

**Evidencia a devolver:** salidas completas de Node y Vite, confirmación de arranque Electron, grabación breve o descripción auditiva de fade 2 s y activación/desactivación del efecto, prueba en Player/exportado y cualquier error visible.

**Criterios de cierre:** las pruebas automáticas por sí solas no cierran el Gate. Pendientes compilación local de este cambio, audio real y aprobación expresa del usuario. Registrar PASS únicamente con evidencia.
