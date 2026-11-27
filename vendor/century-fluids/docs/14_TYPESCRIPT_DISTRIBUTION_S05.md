# CF-S05-001 — Distribución interoperable TypeScript / JavaScript

**Gate autorizado:** `CENTURY-FLUIDS-S05-G001-INTEGRAL-TYPESCRIPT-DISTRIBUTION-AND-INTEROPERABILITY` (2026-11-19). El identificador anterior `...INTEGRAL-JAVASCRIPT-INTEROPERABILITY-AND-DISTRIBUTION` era una denominación de planificación, reemplazada por la declaración literal de S05; ambos designan **un único S05-G001**, sin G002 ni Sprint adicional.

## Objetivo y alcance ejecutado

El núcleo continúa siendo un paquete ESM escrito en TypeScript, sin importaciones ni dependencias de Century, Jolt, Three.js o APIs de Node en `src/`. El artefacto **no es WebAssembly**. JoltPhysics.js mantiene su WASM para el adaptador de S06, que no se implementa aquí. S08 Century sigue EN PAUSA.

El paquete `@century/fluids` 0.1.0 mantiene `private: true`, `UNLICENSED` y `files: ["dist"]`. Se puede generar e instalar un archivo `.tgz` local, pero **no** se autoriza publicar al registro público de npm ni se afirma que exista una licencia redistribuible. La liberación comercial/licencias se decidirá mediante autoridad contractual superior cuando corresponda.

La API existente (`FluidWorld`, `FluidConfig`, `Vec3`, `LiquidSolverConfig`, `FluidError` y sus tipos) se mantiene. `exports` permite importación ESM con resolución de declaraciones TypeScript. Se definen `main` y `module` coherentes con la entrada; no se ofrece CommonJS `require`. El paquete es apto para Node.js 20+ y navegadores con módulos ES + import map o bundler; **no resuelve automáticamente imports bare en navegadores sin import map**.

El hook `prepack` reconstruye `dist` antes de `npm pack`; solo se empaquetan runtime JS, declaraciones y mapas, más `README.md`/`package.json` agregados por npm. Se excluyen tests, QA, ledger, dependencias y fuentes Rust. No se conserva `dist` ni tarballs generados en SOURCE_BASELINE.

## Memoria, datos e interoperabilidad

`FluidWorld` es la autoridad única de partículas y contornos. `particleSnapshot()` entrega copias `Float64Array` separadas del estado interno: los consumidores pueden transferir sus propios `ArrayBuffer` sin transferir memoria del solver. No se promete acceso de escritura directa ni zero-copy al estado físico. Se prueban `structuredClone`, error `CLOSED`, ciclo de vida y resultados numéricos idénticos de una partícula en Node y Chromium (cuando se disponga de navegador ejecutable).

Un consumidor externo debe crear y cerrar sus propias instancias, usar configuración física validada y elegir el reloj de simulación. No se introducen adaptadores del motor ni shaders dentro del paquete.

## Comandos y criterios QA

Desde cualquier carpeta con los archivos extraídos (no exige llamarse `CENTURY_FLUIDS`):

```sh
npm ci
python3 qa/verify_s05.py --project .
```

Esto verifica estructura/manifiesto/ledger, TypeScript strict, pruebas y benchmarks S02–S04, tarball, consumidor JavaScript Node y consumidor TypeScript externo. La salida `S05_CORE_QA_PASS browser=NOT_VERIFIED` **no** equivale a QA integral del navegador.

## S05 CONT004 — Validación web con Vite (vigente, sustituye headless)

El usuario autorizó continuar el mismo S05-G001 con una página de prueba Vite en lugar de seguir depurando Brave headless. No se crea nuevo Gate, no se cambia el núcleo de física ni se instala Vite como dependencia del paquete principal. Las instrucciones de headless de CONT002/003 quedan **históricas y supersedidas para aceptación de S05**; sus pruebas unitarias y evidencias se preservan.

```sh
npm ci
python3 qa/verify_s05.py --project .
node tests/run_vite_qa.mjs
# En Brave gráfico: http://127.0.0.1:5173/
```

El lanzamiento Vite usa `npm exec --package=vite@8.3.8` (pin de herramienta QA, instalada en caché npm cuando hay acceso a registro; **no** es dependencia runtime ni entra en package-lock). `tests/run_vite_qa.mjs` crea un consumidor temporal, ejecuta `npm pack` con `prepack` compilado, instala el `.tgz` con `npm install --offline --no-save`, verifica que `@century/fluids` se resuelve desde `node_modules` del consumidor y calcula `expected.json` ejecutando el mismo `probe.mjs` en Node. El servidor Vite sirve ese consumidor separado. `src/` y el proyecto Century no forman parte de la página. El proceso se detiene con Ctrl+C y el consumidor temporal se elimina.

La página `tests/browser-vite/` importa el paquete mediante `@century/fluids`, ejecuta `FluidWorld` con una partícula de agua y 5 ms, comprueba masa, instantáneas desprendidas y lifecycle; compara `id`, `count`, `mass`, `convergence`, `y` y `vy` con el resultado Node (tolerancia absoluta 1e-12). Muestra `S05_BROWSER_PASS`/`S05_BROWSER_FAIL` y valores completos en pantalla y consola. **No** implica renderizado del agua ni QA de FPS; el playground S09 permanece pendiente.

`node tests/run_vite_qa.mjs --prepare-only` verifica solamente empaquetado e instalación en consumidor independiente, sin iniciar Vite; emite `S05_VITE_PREPARE_PASS browser=NOT_VERIFIED`. El argumento anterior `python3 qa/verify_s05.py --project . --browser` realiza QA core + preparación y devuelve **código 2 / S05_BROWSER_MANUAL_REQUIRED**, nunca declara PASS de navegador sin una ejecución real. `npm run qa:browser` ahora equivale a `node tests/run_vite_qa.mjs`, y `npm run qa:browser:legacy` retiene el diagnóstico headless anterior fuera del flujo vigente.

**Aceptación:** el usuario abre `http://127.0.0.1:5173/` en Brave gráfico, confirma `S05_BROWSER_PASS`, informa los valores y verifica ausencia de errores de carga en consola. El servidor disponible, el smoke test Node o la prueba automática de paridad sin Brave no justifican QA BROWSER PASS. QA authoría en contenedor puede verificar preparación/Node pero el registro npm no resuelve DNS, así que la ejecución del servidor Vite en autoría sigue **NO VERIFICADA**. No se inventa el PASS. El problema previo headless/AppArmor se mantiene como diagnóstico independiente, no como prerrequisito de la biblioteca.

`npm pack` genera el artefacto distribuible; su archivo temporal de prueba no forma parte del SOURCE_BASELINE. Antes de una publicación futura se revisarán licencia, semver, tamaño, seguridad y compatibilidad de browsers de destino.

## Evidencia y límites

S05 en autoría: TypeScript 5.8.3, Node 22.16.0, npm 10.9.2; 58/58 tests; empaquetado y consumidor Node/TS PASS. Chromium de este contenedor no logra completar un arranque headless incluso con página de datos vacía; por tanto **browser QA NO VERIFICADO**. QA local usuario, aprobación y cierre permanecen pendientes.

El límite `iteration_limit` reportado en el tanque S04 sigue abierto para estabilización numérica y no se confunde con convergencia física. S08 permanece EN PAUSA. La liberación v1.0 sigue sujeta al contrato S10 vigente, incluyendo la contradicción de Century S08 o el Amendment que resuelva el alcance.

## S05-G001 CONT002 — Descubrimiento correcto de navegador (2026-11-19)

Evidencia del usuario: la validación local `--browser` compiló y ejecutó 58/58 tests, `npm pack` y consumo Node/TS PASS, pero terminó en `S05_BROWSER_QA_BLOCKED` antes de cargar una página, al no encontrar ningún ejecutable conocido en `PATH`. La ruta de ejemplo `/usr/bin/google-chrome-stable` no existía/ejecutaba en ese equipo. **Esto no prueba incompatibilidad del paquete en navegador.**

Se amplía únicamente la infraestructura S05 de QA:

- `tests/browser_discovery.mjs` descubre Chrome/Chromium, Brave, Edge y Vivaldi como programas nativos y reconoce instalaciones Flatpak mediante identificador de aplicación instalado, sin ejecutar comandos mediante un shell.
- Acepta `CENTURY_FLUIDS_CHROME=/ruta/real/del/binario` o `CENTURY_FLUIDS_FLATPAK_ID=org.chromium.Chromium` (también `com.google.Chrome`, `com.brave.Browser`, etc.). La ruta inválida no impide probar candidatos posteriores. Un identificador inválido no se ejecuta.
- `node tests/browser_discovery.mjs` realiza una comprobación rápida; emite `S05_BROWSER_FOUND` si encuentra uno y `S05_BROWSER_QA_BLOCKED` con instrucciones si ninguno está disponible. La comprobación de descubrimiento **no equivale** a ejecutar QA del navegador.
- `python3 qa/verify_s05.py --project . --browser` continúa requiriendo un navegador real. Se añade terminación del grupo de procesos al agotar el tiempo, incluso si el lanzador Flatpak deja procesos descendientes.
- Las seis pruebas nuevas verifican la selección y ausencia de binarios mediante respuestas simuladas; **no simulan una ejecución real de Chromium y nunca generan S05_BROWSER_PASS**.

Si `node tests/browser_discovery.mjs` informa ausencia de navegador, instalar o facilitar uno compatible es un requisito del **entorno de QA**. No se añadirán dependencias Chromium, Playwright ni Electron al núcleo; no se iniciará S06 como sustituto de esa evidencia. El `iteration_limit` del tanque S04 se mantiene sin ocultar.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.
