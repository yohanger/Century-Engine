# QA · LF-FILMMAKER-EDIT-WORKSPACE-S01-G002-INTEGRAL

**Estado:** APROBADO EXPRESAMENTE POR EL USUARIO (2026-11-05) · IMPLEMENTADO · TEST AUTOMATIZADO PASS PARCIAL (197 PASS/3 SKIP/0 FAIL) · COMPILACIÓN G002 Y QA LOCAL DOCUMENTADO PENDIENTES · NO CERRADO.

## Automatización realizada

- `node --test scripts/test-filmmaker-edit-workspace-s01-g002-integral.mjs` → 13: 12 PASS, 1 SKIP JSZip, 0 FAIL.
- Regresión FilmMaker de 16 suites existentes y nuevo Gate → 200: 197 PASS, 3 SKIP, 0 FAIL.
- `node --check` en `montage.js`, `session.js` y prueba integral → PASS.
- Logs en `docs/qa/evidence/LF-FILMMAKER-EDIT-WORKSPACE-S01-G002-INTEGRAL/`.
- El test anterior ANIM-UI-21 se revisó para conservar su garantía: RAF cuando hay pistas de nodo y no hay planos ni audio; audio con o sin nodos usa Player.

## QA a ejecutar desde la raíz existente (contiene package.json)

```bash
node --test scripts/test-filmmaker-edit-workspace-s01-g002-integral.mjs scripts/test-filmmaker-edit-workspace-s01-g001.mjs scripts/test-filmmaker-anim-s01-g002.mjs scripts/test-filmmaker-anim-s02-g001.mjs scripts/test-filmmaker-camera-nav-device-g001.mjs
npm run filmmaker -- --build
```

**Salida esperada:** sin test `not ok`; el test `S01G002-13` de JSZip debe pasar en el equipo con dependencias instaladas. Vite debe finalizar `built in ...`, FilmMaker abre dentro de Electron. La compilación no certifica QA visual.

## QA local manual (usuario)

1. Abrir FilmMaker en Electron y elegir una película de prueba existente (no sobrescribir producciones de trabajo).
2. Comprobar que Timeline puede ampliarse/restaurarse y que paneles/viewport permanecen operativos; comprobar selector Laptop/PC sin regresión (su QA independiente sigue en NAV-G001).
3. Con un pase de **2 s**, añadir subtítulo que termina en **5 s**; comprobar que el final de Timeline es 5 s, que el último fotograma del plano permanece disponible para el overlay y que Play llega hasta ese final sin recortarlo.
4. Crear una película de prueba sin pases de cámara pero con **un clip de audio** en la Timeline. Pulsar Play desde la Timeline, Pausa y Seek; no debe mostrar error de «añade un plano» ni permanecer en silencio por ausencia de pase. No añadir cámaras ficticias.
5. Comprobar reproducción de pistas de nodo sin planos ni audio: mantiene su previsualización de autoría original.
6. Mover el cabezal adelante y atrás sobre texto, fundido y audio; verificar estados consistentes, sin duplicar audio ni disparar efectos irreversibles.
7. Guardar y reabrir `.nfm`: verificar IDs/capas, tiempo final y pistas; exportar usando el flujo existente y verificar consumo en LevelForge/Cinematics sin pérdida.
8. Cerrar y reabrir Electron sin errores de ciclo de vida.

## Evidencia a devolver

- Salida final de tests y build, indicando PASS/SKIP/FAIL.
- Captura de Timeline donde el subtítulo se extiende más allá del último plano.
- Reporte de si el audio sin planos reproduce y si el seek es estable.
- Resultado de guardado `.nfm`, reapertura, exportación/consumo y funcionamiento de paneles.

**No cerrar automáticamente.** Si hay defecto, analizar evidencia y corregir dentro del Gate antes de cierre.

## Aprobación del usuario — 2026-11-05

El usuario respondió «Aprobado. Sigamos.» a la entrega de G002 Integral. Se registra **APROBADO POR USUARIO** como decisión expresa. No adjuntó en esa respuesta la salida de `npm run filmmaker -- --build`, el resultado local de JSZip/S01G002-13, capturas ni pruebas de guardar/reabrir/exportar `.nfm`.

Por exigencia del contrato de QA, esta declaración **no equivale a PASS de las pruebas ausentes**. El Gate y Sprint siguen **PENDIENTES DE CIERRE TÉCNICO**. El siguiente Sprint puede diseñarse, pero el cumplimiento de sus prerrequisitos debe contrastarse antes de autorizar implementación.
