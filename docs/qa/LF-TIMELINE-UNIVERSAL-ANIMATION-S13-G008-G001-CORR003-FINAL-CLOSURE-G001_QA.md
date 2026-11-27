# LevelForge — FINAL-CLOSURE-G001 · Acta técnica de cierre condicionada

**Fecha del Gate:** 2026-11-11.  
**Gate autorizado literalmente:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-FINAL-CLOSURE-G001`.  
**SOURCE_BASELINE exclusivo de entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_FINAL_COVERAGE_G001_SOURCE_BASELINE.zip` (3.119 archivos, ZIP CRC OK).  
**Autoridad:** CORR-003, FINAL-COVERAGE-G001, UPA-CA-002/003/004; Camera Orchestration S15-G006/G007, FilmMaker, Jolt y propietarios vigentes.  
**Resultado:** **CIERRE NO APROBABLE TODAVÍA / CORR-003 ABIERTO**. No se ha recibido evidencia de QA local Editor+Player. No se alteran los contratos para declarar éxito.

## 1. Auditoría y límites — OBSERVADO, INFERENCIA, CAUSA RAÍZ

**OBSERVADO:** El baseline final de cobertura conserva la aplicación de siete canales adicionales de Luz, los 34 tipos inventariados, el ledger de seis hojas y los Amendments ratificados. No se ha verificado un caso real por tipo en Electron ni el Player exportado independientemente. En Camera Orchestration el motivo `cameraExit.interrupted` sigue definido pero sin emisor de preempción aceptada: el runtime rechaza adquirir cámara mientras otra toma tiene autoridad. La política de Camera Shake que omite `film`, `timeline`, `pose` es intencional. El Inspector presenta parámetros editoriales de escaleras que no tienen aplicador temporal certificado y opciones de Luz `shadow`/`shadowRes` y `mode` sin llave.

**INFERENCIA LIMITADA:** La ausencia de dependencias npm y los harnesses históricos desfasados explican varios fallos de la regresión; los resultados no permiten afirmar que haya fallos WebGL, Jolt, exportación o audio. Tampoco se puede afirmar que el comportamiento sea correcto sin ejecutarlo. La cobertura de 34 tipos **es inventario y rutas implementadas**, no una validación uno-a-uno del Inspector.

**CAUSA RAÍZ confirmada para harnesses actualizados:** las pruebas antiguas invocaban funciones con datos de contexto que el propietario actual suministra mediante `_cameraActive`, `_nodeEnabled` o el import `nodeAnimationProperty`. Se han ajustado exclusivamente **las pruebas originales** (sin alterar producción) para reflejar los puntos de integración existentes. La ruta de Inspector del clip de Shake es ahora un selector de recurso y no un editor de clips incrustado.

**NO DEMOSTRADO:** la causa de cualquier diferencia visual, de Player, colisión, persistencia o rendimiento. No se declara FIXED por inferencia.

## 2. Alcance efectivo de este Gate

- **Cuatro harnesses históricos corregidos:** `scripts/test-camera-shake-s01-g001.mjs`, `-g002.mjs`, `-g003.mjs` y `scripts/test-camera-orchestration-s15-g005.mjs`. Estas modificaciones solo afectan pruebas automatizadas. No se deshabilitaron pruebas ni se alteraron las fuentes de runtime, Inspector, Scene, Assets, FilmMaker, exportación ni Jolt.
- **Documentación y evidencia:** esta acta, matriz de QA local, logs conservados y ledger actualizado conservando las filas históricas de las seis hojas.
- **Sin nuevos gestores, escenas, scripts de verificación, refactors ni extensiones de canales.** No se modifican CA-002/003/004 ni la política Camera Orchestration.

## 3. Evidencia realmente ejecutada (entorno de auditoría)

**Entorno:** Linux del entorno de auditoría, Node `v22.16.0`, npm `10.9.2`; no representa el equipo ni la ejecución del usuario. Se ejecutó sobre copia extraída del SOURCE_BASELINE 3.119; `node_modules` no forma parte de la entrega.

| Prueba / evidencia | Resultado | Interpretación estricta |
|---|---|---|
| Focal CORR-003 + S15-G007 + Shake G004 (`node-focal.log`) | **264 PASS / 0 FAIL / 0 SKIP** | Rutas Node seleccionadas, no Editor/Player |
| Harnesses corregidos G001+G002 (`harness-g001-g002.log`) | **46 PASS / 0 FAIL** | Orquestación de cámara y receta de Shake con dobles controlados |
| Harnesses corregidos G003+S15-G005 (`harness-g003-g005.log`) | **34 PASS / 0 FAIL** | API Shake y Preview, no GPU |
| Regresión ampliada de 63 suites (`node-extended.log`) | **1.011 tests: 992 PASS, 14 FAIL, 5 SKIP** | **NO PASS global**; ver clasificación abajo |
| Pruebas cruzadas CSG/Jolt/Navigation/audio/Cinematics (`node-cross-systems.log`) | **168 tests: 150 PASS, 16 FAIL, 2 SKIP** | **NO PASS global**; fallos de harness y carga de módulos |
| Sintaxis 12 archivos JS/MJS (`syntax.log`) | **12/12 PASS** | No reemplaza compilación Vue/Vite |
| `npm ci --offline` (`npm-ci-offline.log`) | **ERROR ENOTCACHED** | Faltan tarballs del caché npm |
| `npm ci` con registro (`npm-ci-network.log`, `npm-registry-diagnostics.log`) | **ERROR npm / EAI_AGAIN DNS** | Descarga de dependencias no disponible en este entorno |
| `npm run build` (`build.log`) | **exit 127, vite: not found** | Compilación Editor/Player NO VERIFICADA |
| `npm run electron` + GPU | **NO EJECUTADO** | Dependencias y entorno visual ausentes |
| Player AppImage exportado independientemente | **NO EJECUTADO** | Sin QA local del usuario |
| FPS/RAM en Pentium N5030 + Jolt WASM real | **NO MEDIDO** | Sin evidencia de rendimiento |

**Clasificación de los 14 FAIL de la regresión ampliada:** cuatro de dependencias ausentes (`jszip` ×3; `@vue/reactivity` ×1); el test waveform no pudo iniciar por ausencia de `@vue/compiler-sfc` (un FAIL de carga de suite); nueve comprobaciones textuales/estructurales de pruebas históricas divergen del código actual (Cinematics ×3; fade ×1; Preview S11 ×1; animación universal ×2; G008 ×2). Se conservan **sin modificar**: no se ha reconciliado cada una con su última autoridad documental para declarar que son obsoletas. Las pruebas con fallos no se cuentan como PASS.

**Clasificación de los 16 FAIL de pruebas cruzadas:** catorce usos de fixture CSG que no inyecta `nodeEffectiveActive`, una función `validateSignalConnections` omitida en una extracción de migrador y una suite física cuyo adaptador extraído en `data:` no resuelve el import relativo `./shapes.js`. Esta observación es del harness; no constituye prueba de que CSG o Jolt funcionen en el runtime real.

## 4. Contradicciones y pendientes que impiden cierre

1. **QA local no disponible:** falta ejecución de Electron, Player exportado real, guardado y carga, transporte, STOP y restauración por usuario. Es **bloqueo material**, no formalidad.
2. **Compilación no certificada:** Vite y dependencias npm no disponibles. Se necesita compilación reproducible en el equipo local.
3. **Regresión global no PASS:** fallos de harness/expectativas antiguas requieren decidir con autoridad cuáles son pruebas obsoletas y cuáles reflejan defectos; no se declara PASS general.
4. **Cobertura de controles sin canal ni exclusión expresa:** escalera (`steps`, `turn`, `sides` y parapetos) y Luz (`shadow`, `shadowRes`, `mode`) siguen sin contrato de animación temporal ni exclusión específica que habilite declarar cobertura universal completa. No se reconstruirá geometría por frame ni se cambiarán recursos compartidos por inferencia. Si son indispensables, se requiere Gate técnico; si deben excluirse, Contract Amendment ratificada. **Ninguna exclusión nueva se presume aprobada.**
5. **Camera Orchestration S15-G007:** `cameraExit.interrupted` no tiene emisor de preempción admitida, según la arquitectura vigente. Se documenta por separado como **PENDIENTE PLANIFICADO**, no como una conexión olvidada. No declarar G007 ni esta política como QA PASS.

**Criterio de decisión:** el desarrollo funcional presupuestado se considera implementado dentro de los Amendments vigentes, pero **CORR-003 y FINAL-CLOSURE-G001 permanecen ABIERTOS**. Este Gate no autoriza resolver los puntos 4 y 5 mediante nuevas funcionalidades de producción o reescribir el contrato.

## 5. Contratos y seis hojas del ledger

- `ROADMAP`: registrar el Gate y el bloqueo de cierre; no adelantar Sprint siguiente.
- `BACKLOG`: registrar QA local / build / reconciliación contractual sin etiquetar una conexión planificada como olvidada.
- `DEPENDENCIES`: relación de bloqueo con Electron, Player, dependencias, definición de canales y Camera Orchestration.
- `GATES`: autorización literal, implementación del QA y estado **NO CERRADO**.
- `EVIDENCE`: pruebas ejecutadas y referencias a los logs de este Gate. No convertir un exit 127 en PASS.
- `TRACEABILITY`: referencias a los archivos originales, contratos, suites y matriz de QA. Historial existente íntegro.

No se modifica de manera retroactiva la calificación de FINAL-COVERAGE ni las filas de continuaciones anteriores. Aprobación de implementación del usuario ≠ QA LOCAL PASS ≠ cierre formal.

## 6. Operativa para QA local

Consultar `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-FINAL-CLOSURE-G001_QA-LOCAL.md`. El usuario ejecuta las pruebas en una **copia** del proyecto, conserva el ZIP anterior y devuelve salida íntegra, game.log, capturas o vídeo y resultado del Player AppImage ejecutado fuera del Editor. No sobrescribir proyectos ni assets propios; no aplicar simultáneamente CHANGE y SOURCE_BASELINE.

**Entrega:** dos ZIP: CHANGE (solo harnesses, acta, matriz, evidencia y ledger afectados) y SOURCE_BASELINE completo y acumulativo. Comparación exacta con FINAL-COVERAGE documentada en la respuesta del Gate. No entregar SHA-256 separado ni scripts `.sh`.

## 7. Resultado del Gate

**IMPLEMENTADO:** reconciliación documental y harnesses QA.  
**TEST AUTOMATIZADO PASS:** solo baterías PASS descritas en §3.  
**COMPILADO:** NO VERIFICADO.  
**QA LOCAL PASS:** NO VERIFICADO.  
**APROBADO POR USUARIO:** aprobación previa de entrega funcional, no certificado de pruebas de este Gate.  
**CORR-003 / S13-G008:** **ABIERTO, CIERRE BLOQUEADO**.  
**SIGUIENTE ACCIÓN REAL:** ejecutar QA local y resolver evidencia de los bloqueos; solo entonces registrar PASS y solicitar aprobación expresa de cierre. No seleccionar ni implementar el siguiente Sprint hasta el cierre documental.
