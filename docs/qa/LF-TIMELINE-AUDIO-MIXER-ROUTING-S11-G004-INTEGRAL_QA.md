# QA · S11-G004 Audio Mixer Routing

Gate `LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL`. Autorización literal el 2026-11-07. Fuente: SOURCE_BASELINE G003 CORR-002 (aprobado).

## Pruebas automatizadas en el entorno de generación

- Suite G004: **22 PASS / 22**, cero FAIL. `scripts/test-timeline-audio-mixer-routing-s11-g004.mjs` verifica IDs, compatibilidad de nombres, referencias borradas, serialización, adaptadores de Preview/Player, Stop seguro, Inspector y el grafo del AudioEngine (bus→FX→padre).
- Regresión focal combinada: **77 PASS, 0 FAIL, 6 SKIP** de 83. Incluye G004, S11-G001 integral y CORR001, S02 audio y seguridad del proyecto. Log: `docs/qa/evidence/LF_S11_G004_NODE.log`.
- Electron embebido: fixture nueva `scripts/fixtures/editor/timeline-audio-mixer-routing-s11-g004.html` con 31 verificaciones de UI/AudioEngine/Player/Preview (mínimo 30). **NO VERIFICADO** en este entorno: la suite finalizó FAIL de infraestructura al no encontrarse Vite. `LF_S11_G004_ELECTRON_BLOCKED.log`. No declarar FAIL funcional de ruteo.
- Compilación Editor/Player: **NO VERIFICADA** en este entorno. `npm run build` finalizó 127: `vite: not found`. `LF_S11_G004_BUILD_BLOCKED.log`.
- Instalación de dependencias con `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund` fue interrumpida por límite de ejecución de infraestructura; no se verificó la instalación. No se incluyen node_modules en los ZIP.
- Regresión histórica G003 CORR-002: 504 PASS/510 y seis FAIL preexistentes, **conservados como históricos**, no convertidos en PASS ni atribuidos a G004. El QA G003 se aprobó por el usuario y su cierre documental se registró en `...CORR-002_CLOSURE.md`.

## Instrucciones de aplicación y QA local

1. Desde la raíz **existente** de LevelForge (directorio que contiene `package.json`), compara los archivos del CHANGE con las modificaciones locales que aún no estén incluidas en el SOURCE_BASELINE. Respalda previamente esas modificaciones. No sobrescribas sin comparar ni borres tus proyectos/Assets/escenas.
2. Extrae `LF_TIMELINE_AUDIO_MIXER_ROUTING_S11_G004_INTEGRAL_CHANGE.zip` **en esa raíz**, manteniendo las mismas rutas. Alternativa aislada: extrae el SOURCE_BASELINE completo en una carpeta nueva y ejecuta desde allí.
3. Desde dicha raíz ejecuta:

```bash
npm ci
node --test scripts/test-timeline-audio-mixer-routing-s11-g004.mjs scripts/test-timeline-preview-runtime-s11-g001-integral.mjs scripts/test-timeline-preview-runtime-s11-g001-corr001.mjs scripts/test-audio-s02.mjs scripts/test-project-safe.mjs
node --test scripts/test-timeline-audio-mixer-routing-s11-g004-electron.mjs
node --test scripts/test-timeline-audio-waveform-inspector-s11-g003.mjs scripts/test-timeline-preview-runtime-s11-g001-corr001.mjs scripts/test-project-safe.mjs
node --test scripts/test-timeline-audio-waveform-inspector-s11-g003-electron.mjs
npm run build
npm run electron
```

4. Esperado con dependencias y pantalla gráfica: todas las 22 pruebas nuevas PASS; Electron G004 **1 test PASS con al menos 30 comprobaciones**; suite G003 conserva la evidencia 37 PASS Node y su fixture de 22 comprobaciones, salvo regresión real que deba diagnosticarse. Build termina con Vite Editor y Player. No asumir que la cuenta de SKIP del entorno de generación se repetirá en el equipo local.
5. En Electron embebido, crea/abre un proyecto existente no crítico. Inserta clave Audio. Abre Mixer, añade un bus personalizado hijo de Música, conserva un efecto del bus ya disponible (p. ej. lowpass). Asigna ese bus al clip desde Inspector y comprueba que se oye por el bus, y que sus mute, solo, fader y efecto actúan durante Play. Repite tras guardar y reabrir. Comprueba Player real y la exportación disponible sin alterar la fuente.
6. Prueba una referencia antigua que guarde el nombre del bus (solo si el proyecto ya la tiene), el cambio de nombre de un bus vinculado por ID y el borrado de un bus referenciado en una **copia** del proyecto. Esperado: ID se conserva; bus ausente se señala en Inspector; audio con bus ausente entra en SFX; Stop dirigido al bus ausente no silencia todo SFX.
7. Durante Preview, selecciona y cambia de pestaña entre Timeline y Mixer mientras sigue sonando; selección sin arrastre no pausa, arrastre real pausa reloj y audio juntos y Stop restituye la escena. Confirma waveform, offset, pitch, duración y Camera3D sin regresión.

**Evidencia a devolver:** salida completa de Node, Electron, build, y resultado local de escucha/Player con las rutas de clips y buses usados. Si falla, indicar pasos, valor de `key.group`, bus real y captura de Inspector/Mixer, junto con los logs. No repetir QA de G003 ya aprobado salvo incidencia concreta. No instalar un motor nuevo ni ejecutar pruebas con navegador externo.

## Cierre

G004: IMPLEMENTADO EN FUENTES; TEST AUTOMATIZADO NODE PASS; COMPILACIÓN NO VERIFICADA; ELECTRON NO VERIFICADO; QA LOCAL PENDIENTE; APROBACIÓN PENDIENTE; **NO CERRADO**. El cierre de G003 CORR-002 se registra por separado.
