# LevelForge — S12-G002 CORR-002 · QA y estado

## Autoridad y alcance

- Autorización literal recibida: `Listo. LF-TIMELINE-AUDIO-TRIM-DURATION-S12-G002-INTEGRAL_CORR-002 autoriza comenzar`.
- SOURCE_BASELINE de entrada: `LF_TIMELINE_AUDIO_TRIM_DURATION_S12_G002_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.
- Afectación de producción: únicamente `src/components/TimelinePanel.vue`; no se alteran Player, AudioEngine, formas de onda PCM, Assets ni la duración de otros tipos de pista.
- Evidencia local del usuario: Node G002+CORR-001 **22 PASS**; Electron **FAIL** en «Asa integrada en el borde derecho», después de tres comprobaciones internas PASS. **Gate G002 CORR-001 NO aprobado.**

## Análisis

**OBSERVADO:** `.key` desplaza visualmente las claves `translateX(-7px)`; el clip `audio` heredaba esa transformación aunque tenía ancho calculado como duración×zoom. El asa, en cambio, se coloca en `(key.t + audioDisplayDuration(key)) * zoom` y se alinea por su borde derecho con `translateX(-100%)`.

**CAUSA RAÍZ EN CSS:** el clip de duración Audio y su asa tenían sistemas de anclaje distintos. El desplazamiento de una clave puntual no es apropiado para una banda temporal.

**CORRECCIÓN:** regla específica `.lane .key.audio` con `transform:none`, `box-sizing:border-box` y `min-width:0`. Conserva el anclaje puntual de Cámara/Nodo/Métodos. La fixture exige errores geométricos menores a 1 píxel y verifica inicio y fin de Audio, clip sin fuente, cambios de zoom y offset/pitch, sin elevar tolerancias.

## Evidencia generada

| Dimensión | Estado |
|---|---|
| Implementación | IMPLEMENTADO en copia de trabajo |
| Node focal | **26 PASS / 0 FAIL / 0 SKIP** (G002 18, CORR-001 4, CORR-002 4) |
| Regresión compatible | **118 PASS / 1 SKIP / 0 FAIL**; la prueba omitida requiere compilador Vue no instalado |
| Electron anterior (usuario) | **FAIL**: cuarta comprobación, asa desalineada |
| Electron posterior (generación) | **NO VERIFICADO**: runner no entra a fixture, falta Vite local |
| Build Editor y Player posterior | **NO VERIFICADO**: `vite: not found` |
| Chromium auxiliar de geometría | **NO VERIFICADO**: proceso bloqueado por entorno gráfico; no se declara PASS |
| QA local usuario | **PENDIENTE** |
| Aprobación y cierre | **PENDIENTES** |

**Límite de la evidencia:** las pruebas Node verifican el CSS, los cálculos/contratos existentes y el contenido de la fixture. No equivalen a recorte nativo por ratón ni a la ejecución de Vue en Electron. La fixture ejecuta eventos de puntero sintéticos para parte del recorte; el QA manual con ratón sigue siendo indispensable.

## QA local requerido

Desde la raíz de la copia activa del proyecto, tras comparar los archivos afectados con los cambios locales y aplicar solamente CHANGE:

```bash
node --test scripts/test-timeline-audio-trim-duration-s12-g002.mjs scripts/test-timeline-audio-trim-duration-s12-g002-corr001.mjs scripts/test-timeline-audio-trim-duration-s12-g002-corr002.mjs
node --test scripts/test-timeline-audio-trim-duration-s12-g002-electron.mjs
npm run build
npm run electron
```

Esperado: Node 26 PASS; Electron 1 PASS con **25 comprobaciones internas**, sin error de geometría; compilaciones de Editor y Player completas. En Electron, probar arrastre real del asa con ratón, distintos niveles de zoom, offset/pitch, Snap, Inspector, bloqueo, Home, duración inicial y reproducción Preview/Player. Los resultados no se registran como PASS hasta recibir evidencia real del usuario.

Conservar íntegros el fallo G002 de `audioWaveformPath`, el fallo de asa de CORR-001 y los resultados de G001/G002 históricos. No cerrar automáticamente el Gate.
