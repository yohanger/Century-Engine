# LF-FILMMAKER-EDIT-WORKSPACE-S01-G002-INTEGRAL · Implementación

**Estado:** IMPLEMENTADO EN FUENTE · TEST AUTOMATIZADO PASS · BUILD/QA LOCAL NO VERIFICADOS · NO CERRADO. 2026-11-05.

## Autoridad y continuidad

- Autorización literal del usuario: `Listo. LF-FILMMAKER-EDIT-WORKSPACE-S01-G002-INTEGRAL autoriza comenzar`.
- Baseline: `LevelForge_FILMMAKER_EDIT_WORKSPACE_S01_G001_CLOSE_SOURCE_BASELINE.zip` (2206 archivos, comparado con fuentes extraídas para los archivos afectados). S01-G001 permanece **APROBADO Y CERRADO**.
- Se subsumen el G002 original de integridad temporal y el G003 propuesto de QA de integración; ambos quedan **SUPERSEDIDOS como Gates separados**, no ejecutados.
- Fuentes contractuales: `montage.js` define `film.edit.shots` como secuencia y `film.edit.layers` como superposiciones; el contrato `LF-FILMMAKER-ANIM-S00-G001_CONTRACT.md` fija tiempos absolutos de `nodeTracks`, seek reversible y persistencia sin pérdida de claves. Se mantiene `.nfm` versión 4, sin modificación de esquema.

## Diagnóstico

1. **OBSERVADO:** `montage.js:filmEnd()` calculaba fin por planos, audio, claves de nodos no silenciadas y física, pero omitía capas aunque `effectsAt(T)` las mostraba fuera del último plano y `montageTimeline()` exportaba comandos de capas hasta su `t1`.
   **CAUSA RAÍZ:** ausencia del extremo temporal de overlays en `filmEnd()`. **CORRECCIÓN:** incluir `layer.t1` cuando exista contenido reproducible base. Las capas aisladas continúan sin crear una película autónoma por el contrato existente.
2. **OBSERVADO:** `session.js:montageHasContent()` duplicaba parcialmente la definición de duración y contaba pistas de nodos silenciadas. **CORRECCIÓN:** utilizar la nueva función pura `hasMontageContent(film)` en `montage.js`, compartida por sesión y cálculo de duración, sin crear módulos adicionales.
3. **OBSERVADO:** `NleTimeline.vue:togglePlay()` rechazaba un montaje con solo audio aunque `session.playMontage()` sí admite reproducción sin planos, y en el caso con nodos y audio no iniciaba sonido. **CORRECCIÓN:** cuando hay clips de audio sin planos, invocar el reproductor de montaje oficial; mantener el RAF de autoría existente cuando solo hay nodos/física sin audio.
4. **OBSERVADO:** `playMontage(fromT)` no limitaba los valores negativos/no finitos si se usaba su API directamente, mientras la Timeline sí limitaba el seek. **CORRECCIÓN:** limitar el tiempo de entrada a `[0, total]` antes de evaluar pistas, sin cambiar el reloj de reproducción.

## Archivos originales modificados

- `src/filmmaker/montage.js`: contrato puro de contenido y duración.
- `src/filmmaker/session.js`: detección delegada y tiempo de inicio validado.
- `src/filmmaker/NleTimeline.vue`: reproducción de audio sin planos.
- `scripts/test-filmmaker-anim-s01-g002.mjs`: test anterior ANIM-UI-21 actualizado; ya no supone que todo montaje sin planos use el RAF de nodos incluso si tiene audio.

## No se modifica

- Esquema, versión, codec o identidades `.nfm`; `film.js` permanece intacto.
- Modelos del editor, Player, Cinematics, renderer, física, clima, cámara, Android, WebRTC o UI del Sprint S01-G001.
- Definición de pistas, sincronización de reloj de juego ni reconstrucción de Timeline.
- No se garantiza el fondo/cámara de películas compuestas únicamente de texto/efectos: siguen siendo overlays no reproducibles de forma autónoma.

## Evidencia de este entorno

- Test nuevo: 13 casos, **12 PASS / 1 SKIP JSZip / 0 FAIL**.
- Regresión FilmMaker seleccionada: **200 pruebas, 197 PASS / 3 SKIP / 0 FAIL**. Los SKIP corresponden a dependencias/entornos ausentes (JSZip y dos pruebas dependientes de esbuild/Electron-Vite).
- Chequeo sintáctico Node de JS y test: PASS.
- **No disponible:** instalación `node_modules`, compilación Vite/Electron y sesión visual del usuario. Requiere QA local; no atribuir PASS a estos ámbitos.
- La verificación binaria real de guardar/abrir `.nfm` se ejecutará en el equipo con JSZip instalado y el test S01G002-13 deberá pasar, sin SKIP.

## Integración del Sprint y posterior cierre

S01-G001 ya cerrado. Este Gate contiene el QA final del Sprint S01: menú Laptop/PC, Timeline ampliar/restaurar, preview/seek/reproducción, montaje con plano+texto posterior, película con solo audio, guardado/apertura `.nfm`, exportación a LevelForge y consumo por Cinematics. El usuario ejecuta Electron local. Solo tras QA local y aprobación explícita se podrá cerrar G002 Integral y el Sprint S01.
