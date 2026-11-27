# S09-G001 — Playground independiente de fluidos, QA, rendimiento y estabilidad

**Gate:** `CENTURY-FLUIDS-S09-G001-INTEGRAL-PERFORMANCE-AND-STABILITY` — AUTORIZADO por el usuario.  
**Amendment:** `CF-CA-004-FLUIDS-PLAYGROUND-GENERALIZATION` — RATIFICADO.  
**Baseline:** S07-G001 CORR-001, aprobado en conversación con 89/89 Node y 3/3 Jolt WASM real (evidencia local usuario). **S08 continúa EN PAUSA**.

## Responsabilidades y topología física

- `playground/src/fluids.mjs`: registro deliberadamente mínimo de especializaciones disponibles; solo **agua** mediante el paquete instalado `@century/fluids/water`.
- `playground/src/scenarios.mjs`: datos declarativos y reproducibles de tanque, rotura de presa, esfera estática y flotabilidad; no implementa física.
- `playground/src/simulation.mjs`: consume `FluidWorld`, `JoltFluidBridge` y política de agua. Conserva un mundo por escena y un único orden `bridge.step(dt)` → `JoltInterface.Step(dt,1)`; el escenario sin Jolt ejecuta solamente `FluidWorld.step(dt)`.
- `playground/src/jolt-runtime.mjs`: host aislado para inicialización y liberación de **JoltPhysics.js 1.1.0 WASM real**, suelo rígido estático y cuerpo esférico dinámico. Nunca se importa desde el núcleo ni desde la extracción.
- `playground/src/renderer.mjs`: presentación Three.js/WebGL2 únicamente. Convierte los buffers S07 a `BufferGeometry` indexado y actualiza partículas/cámara/cuerpos. **No** modifica la simulación.
- `playground/src/clock.mjs`: acumulador de paso fijo de 1/120 s, hasta 4 pasos por frame, con registro de tiempo de simulación descartado bajo sobrecarga. No se crea otro reloj físico dentro de Jolt ni dentro del renderer.
- `playground/src/main.mjs`: controles y diagnósticos. El error de una escena pausa la simulación y se expone; no se presenta física simulada de sustitución.

`playground/` es una **aplicación consumidora aislada** con Vite 8.3.8, Three.js 0.186.0 y jolt-physics 1.1.0 fijos. `tests/run_playground.mjs` prepara `npm pack` desde el núcleo y solo instala dependencias y el tarball en `playground/node_modules` (la carpeta `.local` de tarballs está excluida de archivos fuente). No se añade una dependencia de runtime al núcleo. El playground no instala dependencias globales ni modifica Century.

## Instalación y arranque local

Desde la raíz `CENTURY_FLUIDS`:

```bash
npm ci
npm run playground
```

El primer comando instala TypeScript de la biblioteca. El segundo construye y empaqueta `@century/fluids`, prepara el paquete en `playground/.local/`, instala los paquetes del **consumidor únicamente** y arranca Vite en **http://127.0.0.1:5174/**. Requiere npm y conexión de registro en la primera instalación de Vite/Three/Jolt. La instalación no usa `--global` ni produce cambios en `package-lock.json` raíz.

Si se requiere comprobar que Vite construye sin abrir una ventana:

```bash
node tests/run_playground.mjs --build
```

La compilación **no es** QA visual. `node tests/run_playground.mjs --prepare-only` solo empaqueta y tampoco declara que el navegador haya arrancado.

Para QA local del núcleo, distribución, superficie y regresiones:

```bash
python3 qa/verify_s09.py --project .
```

Para incluir QA real Node/Jolt (exige `jolt-physics@1.1.0` instalado en `tests/jolt-real/node_modules`) y build web:

```bash
python3 qa/verify_s09.py --project . --jolt --browser-build
```

Antes del `--jolt`, si hace falta: `npm install --prefix tests/jolt-real --no-save --package-lock=false --ignore-scripts --no-audit --no-fund`.

## Plan QA manual en Brave gráfico

1. Abrir URL, confirmar que la interfaz carga, el badge identifica **Jolt WASM · real** y la consola muestra `S09_BROWSER_READY` con `joltWasmReal: true`. En caso de fallo Jolt, solo las escenas sin Jolt son utilizables; **flotación bloqueada**.
2. **Tanque:** superficie y partículas corresponden, se mueven por gravedad; no se muestran planos de agua virtuales.
3. **Rotura de presa:** cambiar escena, reiniciar y observar fluir la masa inicial. Verificar conservación de masa y anomalías de convergencia; una apariencia plausible no acredita conservación.
4. **Obstáculo:** confirmar que el agua se aproxima, colisiona y responde a una esfera fija. Si el solver informa errores, registrar pasos/escena, sin normalizarlos.
5. **Flotabilidad:** el cuerpo naranja es un cuerpo dinámico **de Jolt real**, acompañado por superficie y partículas. Confirmar el movimiento, si ejerce/recibe impulso y si la física es plausible; la flotabilidad actual es una aproximación limitada.
6. Probar **pausa, avanzar un paso, reproducir, reset**, velocidad y modos de representación. Repetir cambio de escenario y reset 20 veces; comprobar errores de consola y memoria.
7. Registrar tiempo de simulación CPU, extracción CPU, envío de render CPU y FPS. **El tiempo de render CPU no es tiempo GPU real**; `performance.memory` puede no estar disponible. Comparar rápida/equilibrada/detallada sin confundir más triángulos con mejor física.
8. Capturar screenshot/video y log. Solo entonces registrar **S09 QA VISUAL LOCAL PASS** si satisface aceptación de usuario.

## Evidencia en autoría y límites

- Tests Node comprueban escenarios deterministas, separación del registry y física, presupuesto del reloj, packaging y fuentes del consumidor; prueba con tarball **real** y sesiones del solver sin Jolt falso.
- Benchmark CPU no gating: tres escenas con partículas y colisiones reales, 12 pasos, extracción S07, verificación de masa y 50 ciclos de creación/destrucción; recoge memoria sin declarar leak-free a largo plazo.
- Los escenarios usan espaciado físico 0.12 m y masa 1.728 kg/partícula (1000 kg/m³): se corrigió un solape inicial con la esfera que producía `OUT_OF_RANGE` en el primer intento. No es una corrección del solver.
- **NO VERIFICADO en autoría:** arranque efectivo de Vite/Three en navegador, carga/step de Jolt WASM en WebGL y FPS de GPU. El contenedor de autoría no pudo resolver npm (`EAI_AGAIN`). El runner bloquea los falsos PASS.
- **Limitación anterior S04:** `convergence=iteration_limit` para tanque de 216 partículas; no equivale a estabilidad demostrada para todas las cargas. La reconstrucción S07 conserva volumen aproximado, no exacto.

## Licencias externas y aislamiento

Three.js, Vite y JoltPhysics.js están publicados con licencia MIT (documentación de origen: `https://github.com/mrdoob/three.js/blob/master/LICENSE`, `https://github.com/vitejs/vite/blob/main/LICENSE`, `https://github.com/jrouwe/JoltPhysics.js/blob/main/LICENSE`). Los paquetes externos son instalados por npm dentro del playground; no se distribuye ni modifica su código fuente. `@century/fluids` sigue privado/UNLICENSED.

## Estados

S07 **APROBADO** tras 89/89 Node y 3/3 Jolt reales de CORR-001. S09 **IMPLEMENTADO + QA AUTORÍA**; compilación GUI, funcionamiento browser y aprobación/cierre pendientes. S08 **EN PAUSA**. S10 no puede declarar release integral estable con S08 sin completar o sin Amendment expreso.
