# Century Fluids — S09 CONT-005 integral QA review

CONT-005 literalmente AUTORIZADO; NO APROBADO NI CERRADO.

**IMPLEMENTADO:** un único camino de presión/contactos alternados en el solver existente, selección de correcciones con menor residual y sin aumento de energía cinética poscontacto para fronteras estáticas, impulsos y torques de Jolt conservados; salida temprana de recontactos a nivel de redondeo. Se mantienen un solo reloj y un solo `ParticleStore`.

**TEST PASS:** verificar en `qa/S09_CONT005_RUN.log`; el objetivo es 141/141 pruebas, más caracterización A/B de 4³ y 6³. Se conserva el reporte `iteration_limit` cuando las restricciones aún no convergen.

**QA LOCAL PENDIENTE:** JoltPhysics.js 1.1.0 WASM real de Node después de CONT-005, Vite build y GUI Brave con las cuatro escenas. No confundir preparación offline/ESM con GPU y física Jolt real. El entorno de autoría no dispone de resolución DNS npm; instalaciones Jolt/Three/Vite no verificadas.

**LIMITACIONES:** 88/240 y 1/8 pasos aún con `iteration_limit`; velocidad media hidrostática todavía distinta del baseline; reposo por chunks de masa gravitacional conectada todavía inseguro; FPS de hardware sin acreditar. No se declara que S09 esté completado físicamente ni que el release 1.0 esté preparado.

**CONTINUIDAD:** S00–S10 exactamente 11 Sprints y sus Gates principales; S08 EN PAUSA, S10 NO AUTORIZADO. CONT005 permanece dentro de S09-G001; ninguna corrección recibió Gate aparte.
