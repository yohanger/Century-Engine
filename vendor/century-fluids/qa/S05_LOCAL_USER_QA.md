# S05-G001 — Ejecución local aportada por el usuario (2026-11-19)

Comando: `python3 qa/verify_s05.py --project .`

Resultado observado:

```text
S05_STATIC_PASS files=62 sheets=6 sprints=11 gates=11 project=Century Fluids
S05_QA_FAIL: S05_TOOLCHAIN_BLOCKED: node/npm/tsc needed
```

Evidencia: inspección estática PASS, QA dinámico NO EJECUTADO. No es un error demostrado del núcleo ni del paquete. El runner original bloqueaba si `tsc` no estaba expuesto globalmente en PATH, incluso con dependencia TypeScript local instalada.

Corrección del runner dentro de S05-G001. Nueva ejecución local pendiente de evidencia del usuario. No asumir S05 QA LOCAL PASS ni navegador PASS.

## S05-G001 CONT002 — Evidencia local posterior (mensaje usuario 2026-11-19)

Comando: `python3 qa/verify_s05.py --project . --browser`, tras `CENTURY_FLUIDS_CHROME=/usr/bin/google-chrome-stable` y un `command -v` sin coincidencias.

Evidencia: `S05_STATIC_PASS files=63`, TypeScript y ESM PASS, 58/58 tests PASS, `S05_NODE_PACKAGE_PASS`, `S05_TYPES_PASS` y benchmarks S02–S04 ejecutados. `S05_BROWSER_QA_BLOCKED: Chromium or Chrome not found`, código de salida no satisfactorio. La ruta suministrada no era un navegador ejecutable; el proceso no llegó al servidor/página de navegador. **CORE LOCAL PASS**, browser no verificado, no aprobación/cierre.

La corrección CONT002 del descubrimiento debe ejecutarse en el equipo del usuario antes de declarar QA real PASS. Los resultados de pruebas nativas anteriores se conservan como evidencia, no se borran.


## Evidencia nueva — Brave detectado pero headless no responde

El usuario ejecutó `node tests/browser_discovery.mjs`: `S05_BROWSER_FOUND origin=native command=brave-browser`. Después `verify_s05.py --browser` informó 64/64 Node PASS, consumidor Node/TS PASS, pero el hijo Brave `--dump-dom` agotó el timeout de 25 segundos sin stderr. Esto acredita que el descubrimiento funciona; **no acredita fallo de importación de la biblioteca** ni paridad real de navegador.

CONT003 introduce un canary headless independiente y diagnóstico de stderr/stdout para aislar bloqueos del navegador. Se mantiene el estado `BROWSER NO VERIFICADO` hasta ejecución del usuario con navegador real.


## Evidencia local CONT003 y decisión del usuario — 2026-11-19

- El usuario ejecutó `verify_s05.py --browser`: 68/68 tests PASS, TypeScript strict y paquete npm Node/TS PASS; benchmark S04 con `convergence: iteration_limit`, sin penetración final. `S05_BROWSER_ENV_BLOCKED` porque Brave no devolvió DOM del canary headless independiente del paquete. **QA CORE LOCAL PASS; BROWSER NO VERIFICADO.**
- Ejecutó pruebas aisladas headless (`--headless`, `--headless=new`, con perfil temporal y backend headless) sin la biblioteca; `EXIT_CODE=124` con HTML no emitido. Kernel indicó `conflicting profile attachments` en Brave; dos perfiles duplicados, pero no se validó la causalidad del timeout.
- El usuario decidió dejar de investigar AppArmor y usar Vite en modo gráfico. Autorización literal renovada para S05-G001. No se ha recibido aún resultado Vite real ni aprobación final.

## S05 CONT004 — Evidencia gráfica usuario (19 nov 2026)

El usuario aportó captura de Brave normal accediendo al servidor Vite con `S05_BROWSER_PASS`. Indica importación ESM, simulación y paridad Node/navegador. Valores `id=1`, `count=1`, `y=0.99975475`, `vy=-0.04905`, `mass=1` y `convergence=converged`, todos iguales entre `actual` y `expected`. Copia de la evidencia: `qa/S05_VITE_BROWSER_LOCAL_PASS.png`. No se aportó captura de la consola, ni declaración formal de APROBADO/CERRADO. El antiguo bloqueo headless era ajeno a la prueba Vite; no se cambió el sistema operativo.
