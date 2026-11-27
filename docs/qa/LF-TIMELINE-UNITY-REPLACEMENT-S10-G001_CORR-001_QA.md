# QA — S10 G001 CORR-001 (revisión del mecanismo tras rechazo)

**Estado actual:** REIMPLEMENTADO EN FUENTES · PRUEBAS NODE PASS · BUILD DE LA REVISIÓN NO VERIFICADO · **QA USUARIO FALLÓ EN ITERACIÓN PREVIA** · NUEVO QA LOCAL PENDIENTE · NO CERRADO.

## Evidencia real

- **Imagen del usuario del 7-11-2026** (`docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001/user-qa-reject-scroll.png`): nombres a la izquierda pero desbordamiento visual de regla/cabezal/segmentos al desplazar horizontalmente. El usuario declara literalmente **«No aprobado»**.
- **Log del usuario** (`docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001/user-qa-tests-build.txt`): **9 PASS / 0 FAIL** en el test antiguo CORR-001 y `✓ built in 1m 44s` en Vite. Se ejecutó en una carpeta local denominada `LF_FILMMAKER_NLE_DIRECT_AUTHORING_S01_G001_INTEGRAL_CORR004_SOURCE_BASELINE`. El PASS del test antiguo y el build **NO validaron** el desplazamiento.
- El mecanismo anterior de `translateX` y su QA superficial quedan **SUPERSEDIDOS**; el código actual separa físicamente cabeceras del área temporal.

## Evidencia de pruebas de la revisión

- `node --test scripts/test-timeline-unity-replacement-s10-g001-corr001.mjs`: **10 PASS, 1 SKIP, 0 FAIL** (compilador Vue no instalado en contenedor).
- Regresión S04/S07/S08/S09/S10: **117 PASS, 5 SKIP, 0 FAIL**.
- Se revalidaron las aserciones históricas sobre medida del panel, ancho preferido, scrubbing, reglas y cabezal con la geometría nueva. Las pruebas originales que asumían una cabecera dentro del scroller ya no representan el contrato válido.
- Balance HTML de etiquetas del template: **sin etiquetas desbalanceadas en revisión sintáctica básica**; **NO sustituye el compilador Vue**.
- Chromium headless aislado: **NO VERIFICADO** (no completó ejecución). No se ha probado visualmente el layout en Electron aquí.
- Build Vue/Vite de la revisión: **NO VERIFICADO**. QA local: PENDIENTE.

## Instalación incremental segura

**Base exacta del CHANGE rework:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G001_CORR001_SOURCE_BASELINE.zip` (primera entrega). Compara primero cada archivo afectado y respalda modificaciones locales antes de sobrescribir. Si la carpeta local ya contiene mezclas con FilmMaker S01 u otros cambios, prueba el SOURCE_BASELINE rework completo en **una carpeta independiente**, nunca sobrescribas tus recursos.

Desde la raíz de LevelForge con `package.json`:

```bash
node --test scripts/test-timeline-unity-replacement-s10-g001-corr001.mjs
node --test scripts/test-timeline-unity-replacement-s10-g001.mjs scripts/test-timeline-pro-ux-s07-g001-integral.mjs scripts/test-timeline-visual-preview-s08-g001-integral.mjs scripts/test-timeline-advanced-direction-s09-g001-integral.mjs
npm run electron -- --build
```

Si faltan dependencias, `npm ci` antes. Con compilador Vue disponible, la suite específica debe mostrar **11 PASS y 0 FAIL**.

## QA manual obligatorio (Electron)

1. Abrir la Timeline con dos o más pistas. Anotar la frontera vertical entre cabeceras y zona temporal (columna izquierda de anchura ajustable).
2. Desplazar la **barra horizontal inferior** de 0 s a segundos posteriores. **Esperado:** cabeceras, iconos y mute absolutamente inmóviles en X; regla, playhead y clips visibles **solo en la columna derecha**. Pistas cuyos clips quedan antes del viewport ya no se ven, pero sus nombres permanecen.
3. Scroll **vertical** con 10+ pistas: cabeceras y carriles deben seguir alineados en Y; la regla y `+ Pista` permanecen arriba. Probar rueda sobre cabeceras y sobre la zona temporal.
4. Cambiar zoom, Snap y anchura de columna. Comprobar posiciones relativas de clave, segmento y playhead respecto de la regla y la respuesta correcta del cabezal.
5. Probar menú + Pista, silenciamiento, edición por Inspector, creación y borrado de claves, guardado y reapertura del mismo Timeline.
6. Repetir en dock estrecho, acoplado/desacoplado y PlayMode. No alterar FilmMaker.

**Evidencia solicitada:** salida Node, salida final del build, dos capturas de la misma Timeline con `scrollLeft` al comienzo y desplazado; idealmente vídeo corto que muestre transición, y prueba de scroll vertical.

**Estados:** IMPLEMENTADO EN FUENTES: sí; TEST AUTOMATIZADO: 117 PASS, 5 SKIP, 0 FAIL; COMPILADO REWORK: NO VERIFICADO; QA LOCAL: PENDIENTE; APROBADO: NO; CERRADO: NO.


## Cierre QA — 2026-11-07 (posterior a la entrega rework)

**QA VISUAL LOCAL: APROBADO POR EL USUARIO.** Confirmación literal: «Aprobado. Ahora si podemos seguir con los sprints».

**TEST AUTOMATIZADO:** `node --test scripts/test-timeline-unity-replacement-s10-g001-corr001.mjs` → 11 PASS, 0 FAIL, 0 SKIP (prueba CORR001-QA2 con compilador Vue disponible).

**COMPILACIÓN:** `npm run electron -- --build` → Vite 6.4.4, 837 módulos transformados, `✓ built in 1m 28s`. Este registro acredita la compilación Vite. No se reportó una prueba separada del Player exportado.

**APROBADO/CERRADO:** G001 y CORR-001 revisada, dentro de su alcance estructural y de desplazamiento, por aprobación expresa del usuario. La primera CORR-001 basada en `translateX` permanece RECHAZADA/SUPERSEDIDA en el historial.

**NO VERIFICADO en esta evidencia:** prueba completa de Player exportado, persistencia exhaustiva de `.lfproj`, y QA de todos los escenarios de acoplamiento. Estos son guardarraíles de integración de Sprint 10, no resultados PASS inventados.

**Evidencia conservada:** `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001/user-qa-approval-build.txt`. El ledger sincroniza las seis hojas.
