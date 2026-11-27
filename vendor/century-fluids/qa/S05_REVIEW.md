# S05-G001 — Revisión técnica y límites de evidencia

- Gate autorizado: `CENTURY-FLUIDS-S05-G001-INTEGRAL-TYPESCRIPT-DISTRIBUTION-AND-INTEROPERABILITY`.
- Implementación: paquete ESM privado, exports tipados, `prepack`, archivo `.tgz` para consumidores externos, pruebas de buffers detached y lifecycle, test Node/TypeScript desde instalación aislada.
- No se implementaron adaptadores Jolt, WASM propio, renderizado ni cambios Century.
- QA autoría: 58/58 tests; distribución local y consumidores Node/TS PASS. Véase `qa/S05_RUN.log`.
- Browser real en autoría: **BLOQUEADO POR ENTORNO** (Chromium headless no concluye incluso con página vacía). `qa:browser` sigue ejecutable para QA local; no asumir PASS.
- S04: QA local aportado y aprobación usuario registrados; S04 mantiene limitación `iteration_limit` de presión en tanque.
- Estado S05: IMPLEMENTADO, TYPECHECK/BUILD/TEST PASS, CONSUMO NODE/TS PASS, BROWSER NO VERIFICADO, QA LOCAL PENDIENTE, APROBACIÓN/CERRADO PENDIENTES.
- Seguridad del paquete: npm `private: true`, `UNLICENSED`; no npm publish ni declaración de licencia redistribuible.

## S05-G001 — Continuación: runner toolchain local

- Evidencia del usuario: `S05_STATIC_PASS files=62 ... project=Century Fluids` seguido por `S05_QA_FAIL: S05_TOOLCHAIN_BLOCKED: node/npm/tsc needed`. No se llegó a ejecutar `npm run qa`; por tanto no se atribuye fallo al solver.
- Causa confirmada en `qa/verify_s05.py` anterior, línea 73: el runner exigía `tsc` global aunque TypeScript es una dependencia de desarrollo y npm lo resuelve desde `node_modules/.bin`.
- Corrección mínima dentro del mismo S05-G001: comprobar únicamente ejecutables `node` y `npm` antes de ejecutar los scripts; la compilación `npm run qa` acredita la disponibilidad real de TypeScript.
- La prueba de `npm ci` en el entorno de autoría no puede completarse offline por falta de caché npm. La instalación local del usuario debe verificarse mediante su propio QA.
- Esta continuación no agrega Gate ni cambia contratos, código físico o Century. El navegador real sigue sin verificar.
- Regresión de continuación comprobada: ruta sin `tsc` global, TypeScript local 5.8.3; `S05_CORE_QA_PASS` 58/58, paquete/consumidor PASS; navegador y nueva ejecución local usuario pendientes.

## S05-G001 CONT002 — Diagnóstico de navegador y corrección del descubrimiento

- `source.zip` adjunto por el usuario coincide byte a byte con el SOURCE_BASELINE CONT001 en todos sus archivos versionados. Solo contiene adicionales regenerables `dist/` y `qa/__pycache__/`; no hay cambios locales de código que sobrescribir.
- El usuario ejecutó S05 `--browser`: typecheck, build, 58/58 Node y `npm pack`/consumidor Node/TS PASS; el navegador quedó BLOQUEADO **antes de ejecutarse**. `command -v` no encontró los cuatro nombres previstos; el ejecutable `/usr/bin/google-chrome-stable` usado como ejemplo tampoco respondió a `--version`.
- Se auditó `tests/verify_distribution.mjs`: los candidatos originales cubrían solo `chromium`, `chromium-browser`, `google-chrome` y `google-chrome-stable`; no contemplaban Flatpak ni alternativas Chromium. El runner exponía error genérico, sin diagnóstico accionable.
- Solución dentro del mismo Gate S05: descubrimiento native/Flatpak con pruebas unitarias, CLI de diagnóstico y manejo de timeout de grupo de procesos. Sin modificar `src/`, npm runtime dependencies, Jolt, Century ni algoritmos físicos.
- QA de autoría: descubrimiento 6/6 tests, toda la batería Node 64/64 PASS, `npm run qa:s05` con consumidor aislado PASS, integridad/verificador estático/ZIP pendientes de resultado final de esta entrega.
- Navegador físico real: **NO VERIFICADO**, ya que Chromium de autoría no finaliza en modo headless; entorno del usuario requiere detectar o instalar navegador. No declarar S05_QA_PASS aún.


## S05-G001 CONT003 — Timeout de Brave: diagnóstico por capas

- Evidencia local aportada por usuario (2026-11-19): `S05_BROWSER_FOUND origin=native command=brave-browser`; el proceso agotó el timeout de 25 segundos con `stderr` vacío, sin DOM; antes se acreditaron TypeScript/Node 64/64 PASS, consumidor npm/TS PASS y benchmarks S02–S04. **No hubo `S05_BROWSER_PASS`.**
- OBSERVADO en código anterior: `tests/verify_distribution.mjs` confiaba en que el proceso `--dump-dom` finalizara; cuando no finalizaba, registraba `TIMEOUT` sin distinguir arranque headless de importación del paquete. `--virtual-time-budget=8000` no es necesario para el caso de importación y fue retirado en esta continuación.
- CONT003 introduce `tests/browser_headless.mjs`: canary sin biblioteca mediante URL `data:`; lanzamiento headless con timeout diagnosticado; captura DOM real; y terminación del grupo de procesos después de obtener documento completo. El navegador solo se considera validado si el consumidor devuelve DOM `data-qa=PASS` y el resultado numérico coincide con Node.
- Regresión de autoría: 68/68 tests PASS, TypeScript estricto + build PASS, consumidor empaquetado Node/TS PASS. En el contenedor, Chromium 144 detectado (`--version` PASS) no logra devolver siquiera el DOM del canary, con errores DBus y timeout. El código reporta `S05_BROWSER_ENV_BLOCKED` *antes de cargar* Century Fluids. No demuestra que la instalación Brave del usuario tenga esa misma causa.
- **Límite explícito:** la interoperabilidad real en Brave/Chromium del usuario continúa NO VERIFICADA. Se requiere ejecución local de `python3 qa/verify_s05.py --project . --browser`; no ejecutar un browser falso ni declarar QA integral PASS hasta comparaciones numéricas de navegador/Node satisfactorias.
- El núcleo físico `src/`, API, dependencias npm y Century permanecen sin cambios. Corrección dentro del mismo S05-G001; no se crea un Gate/Sprint adicional.


## S05-G001 CONT004 — Cambio de método de QA web (autorizado por usuario)

- Alcance: Vite QA manual, `npm pack` e instalación en consumidor temporal aislado, página con paridad numérica Node/navegador; sin tocar `src/` ni Century.
- `qa:browser` deja de ejecutar headless; `qa:browser:legacy` lo conserva para trazabilidad. `--browser` en Python solo acredita preparación y devuelve código 2 (pendiente de QA manual).
- Vite 8.3.8 se obtiene mediante `npm exec` bajo demanda; no se cambia el lockfile principal ni se añaden dependencias runtime. El primer arranque necesita conexión al registry npm si Vite no está cacheado.
- Reproducción anterior del usuario: Brave 157 headless se bloquea incluso sin biblioteca; se observaron dos perfiles AppArmor asociados al binario, sin relación causal demostrada con el timeout. Ninguno de esos datos demuestra incompatibilidad de la biblioteca.
- Criterios: paquete real de `npm pack` consumido en Node y Vite, igual referencia y seis propiedades numéricas, PASS/FAIL visible, consola sin errores. Servir Vite o preparar paquete **no equivale a QA browser PASS**.
- Estado: Vite y navegador reales pendientes de la ejecución del usuario, S05 sin aprobación/cierre.
