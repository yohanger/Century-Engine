# QA — LF-TIMELINE-AUDIO-INTEGRATION-PERSISTENCE-S11-G006-INTEGRAL

**Estado:** IMPLEMENTADO EN FUENTES; test Node focal PASS parcial con dos SKIP; Electron, compilación y Player exportado NO VERIFICADOS; QA LOCAL PENDIENTE; G006 NO APROBADO/NO CERRADO.

## Historial vinculante
- G005 CORR-001: QA LOCAL PASS declarado por el usuario y APROBADO, registrado documentalmente en las seis hojas; no se atribuyen nuevos PASS a Electron ni build.
- Fallo Electron previo de G005 (43 checks internos PASS + excepción Web Audio) permanece conservado en sus propios documentos/evidencias, sin reclasificación.
- Contratos de Preview S11-G001, Camera3D S11-G002 y audio waveform S11-G003 siguen intactos; G004 y G005 no deben presentar regresiones.

## Cambios
La única modificación de producción es `src/core/buildList.js`, extendiendo `validateBuildSources()` para comprobar audio Timeline antes del empaquetado. No hay transformaciones de recursos antiguos ni nuevos formatos de disco/Runtime.

## Pruebas realmente ejecutadas en el entorno de generación
1. `node --test scripts/test-timeline-audio-integration-persistence-s11-g006.mjs`: **19 PASS, 0 FAIL, 2 SKIP** de 21. SKIP: prueba binaria real `.rtpkg` por `jszip` ausente; prueba `createPackageHost` por `@vue/reactivity` ausente. Log: `docs/qa/evidence/LF_S11_G006_NODE_FOCAL.log`.
2. Combinación G006 + G005 + G004 + S11-G001 + `test-project-safe.mjs`: **119 PASS, 0 FAIL, 4 SKIP** de 123. Log: `docs/qa/evidence/LF_S11_G006_NODE_REGRESSION.log`.
3. `node --test scripts/test-timeline-audio-integration-persistence-s11-g006-electron.mjs`: **NO VERIFICADO**. Runner aborta antes de cargar la fixture por Vite ausente. El proceso Node reporta 1 FAIL **de infraestructura**, no un fallo demostrado del audio. Log: `docs/qa/evidence/LF_S11_G006_ELECTRON_ENV.log`.
4. `npm run build`: **NO VERIFICADO**. Error `vite: not found` (exit 127); no compilación Editor ni Player. Log: `docs/qa/evidence/LF_S11_G006_BUILD_ENV.log`.
5. Flujo AppImage exportado, audio real y UI visual: **NO EJECUTADOS** en este entorno.

## Comandos obligatorios de QA del usuario
Desde la raíz **existente** del proyecto con `package.json`, tras comparar y respaldar cambios locales y aplicar CHANGE sobre G005 CORR-001:

```bash
node --test scripts/test-timeline-audio-integration-persistence-s11-g006.mjs
node --test scripts/test-timeline-audio-integration-persistence-s11-g006-electron.mjs
npm run build
npm run electron
```

Esperado en instalación completa: suite Node 21 PASS / 0 FAIL / 0 SKIP; fixture Electron 1 PASS con al menos 20 comprobaciones internas y WebGL real; `vite build` Editor y `vite build --mode player` finalizan. Las salidas esperadas **no son resultados ya obtenidos**.

QA funcional: usar una copia respaldada de un proyecto con dos claves Audio (una por ID y otra por nombre antiguo), bus personalizado y dos FX distintos. Guardar, cerrar, reabrir y comprobar Inspector/FX/bus; probar Preview (selección, pestañas, pausa/seek/Stop), exportar desde Build a AppImage Linux, abrir el **Player real**, escuchar audio por el bus con FX privados y del Mixer. Probar una copia de proyecto con Audio Asset declarado pero binario ausente: la exportación debe rechazarlo y señalar Timeline/pista/clave sin borrar referencias. Preservar escenas, Assets y proyectos existentes.

Solicitar evidencia: salidas Node/Electron/build; registro o captura del error preflight; resultado auditivo Player; incidencias concretas. Hasta obtenerla G006 queda PENDIENTE QA LOCAL. No iniciar G007 de oficio.
