# Revisión — S09-G001 CONT-004

**CONT-004 AUTORIZADO** mediante declaración literal 2026-11-20; CF-CA-005 RATIFICADO; CONT-003 APROBADO por usuario. S09 y S08 mantienen sus estados: ABIERTO y EN PAUSA, respectivamente.

**OBSERVADO:** el solver SPH no agota iteraciones en los dos casos caracterizados, pero resolver contactos/integrar genera un residual de divergencia final superior al configurado. El `iteration_limit` no es un defecto de conteo de iteraciones en estos casos; el contrato de convergencia debe seguir rechazando esos estados.

**IMPLEMENTADO:** diagnóstico numérico opcional de solo lectura; 4 tests nuevos; runner de caracterización y QA. 

**DESCARTADO:** posproyección sin nueva aplicación de condiciones de contorno. Eliminó `iteration_limit` numéricamente, pero introdujo velocidad entrante a través del apoyo (hasta -0.369417 m/s), por lo que no es una corrección física aceptable.

**BLOQUEADO PARA IMPLEMENTACIÓN EN ESTE CONT-004:** nueva formulación de presión y contornos; no hay diseño numérico ni evidencia Jolt suficientes para adoptarla. No confundir diagnóstico QA PASS con corrección física implementada.

**QA:** se registra en `qa/S09_CONT004_RUN.log`. Los campos `browser_GUI`, `browser_JOLT_WASM`, `Jolt Node post-CONT004` y build Vite solo pueden marcarse PASS con ejecución acreditada. S08 sin alteración.
