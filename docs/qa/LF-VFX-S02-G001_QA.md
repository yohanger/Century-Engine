# LF-VFX-S02-G001 — QA y evidencia

**Gate:** autorización exacta recibida «Listo. LF-VFX-S02-G001 autoriza comenzar». **Prerrequisitos ratificados por usuario:** S00 aprobado e integración S01 funcional. **Fuente:** `LevelForge_VFX_S01_G002_SOURCE_BASELINE.zip`; ZIP CRC íntegro; ninguna modificación local del usuario posterior se ha podido comparar.

## Estados separados

| Verificación | Resultado |
|---|---|
| IMPLEMENTADO | SÍ: `simulation.js`, `render.js`, harness y tests autorizados |
| TEST AUTOMATIZADO VFX-Q06 | **13/13 PASS**, ejecutado sobre `simulation.js` real |
| TEST AUTOMATIZADO VFX-Q07 WebGL | **NO VERIFICADO** en este contenedor (Three.js/Vite no disponibles) |
| Regresión general de proyecto/historial | **27/27 PASS** con `test-project-safe.mjs` y `test-resource-history-corr-g001.mjs` |
| Regresión G001/G002 con JSZip | **NO VERIFICADA** de nuevo (faltan dependencias JSZip y Vite); previamente 63/63 PASS en G002 |
| COMPILADO Editor/Player G001 | **NO VERIFICADO** en este contenedor |
| QA LOCAL | **PENDIENTE**: usuario ejecuta prueba GPU y build |
| APROBADO / CERRADO | NO / NO |

## Pruebas ejecutadas de VFX-Q06

`node --test scripts/test-vfx-simulation-s02-g001.mjs` — 13 PASS, 0 FAIL: misma semilla con 60/120 Hz y reset; independencia entre dos instancias; ráfaga única; ráfaga periódica; emisión continua fraccional; duración sin repetición; pool saturado y nacimientos descartados; delta temporal excesivo diagnosticado; curvas de tamaño/opacidad/color; transform de nacimiento/velocidad en mundo frente a local; muerte y reutilización del pool; entradas inválidas; avance discreto sin consumir el acumulador.

**Resultado ejecutado combinado sin dependencias externas:** 40/40 PASS (13 VFX-Q06 + 27 regresión general). No equivale a la regresión íntegra de los 63 tests de S01.

## QA gráfico real obligatorio (VFX-Q07)

En la máquina local con dependencias instaladas:

```bash
cd ~/ENGINES/lf-0.26.13/lf
npm ci
node --test scripts/test-vfx-simulation-s02-g001.mjs
node --test scripts/test-vfx-webgl-s02-g001.mjs
node --test scripts/test-vfx-resource-s01-g001.mjs scripts/test-vfx-assets-s01-g002.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs
npm run build
npm run electron
```

El segundo comando requiere Chromium accesible como `chromium` (Linux) y un contexto WebGL funcional. Si utiliza otro nombre/ruta, ejecutar con `LF_VFX_BROWSER=/ruta/al/binario` delante del comando. El harness inicia Vite local en 127.0.0.1:43827, lanza Chromium headless y termina ambos procesos. No instala plugins ni manipula proyectos. **Resultado esperado, no acreditado:** 13 tests de simulación, una prueba WebGL con ≥10 verificaciones GPU, regresión 63/63 y compilación de Editor y Player; no registrar PASS hasta ver su salida.

El QA WebGL verifica lecturas reales de píxel con proyección perspectiva y ortográfica; el plano frontal debe ocultar la partícula por depthTest; la textura verde debe dibujarse; alpha no escribe profundidad; aditivo debe producir color visible; una referencia de textura rota debe diagnosticarse; al destruir el emisor su textura compartida no debe liberarse.

El editor abrirá como anteriormente: **este Gate NO incorpora todavía nodos VFX a SceneGraph**, por lo que no se espera ver vapor en el viewport de un proyecto. La integración visual Editor/Play/Player, cambio de escena, padres y PSX corresponde a G002. No validar G001 mirando la escena y suponiendo que existe un nodo VFX3D.

## Límites de evidencia y regresión

- No se ejecutaron shader, GPU ni PSX en este contenedor. La compilación anterior correspondía a G001 de S01 y no acredita este cambio.
- Requiere Vite y `three@0.186.1` de `package-lock.json`; no actualizar dependencias para superar el test. Three.js tiene licencia MIT; las APIs utilizadas son `InstancedBufferGeometry`, `InstancedBufferAttribute`, `ShaderMaterial` y `DynamicDrawUsage`.
- Respetados archivos protegidos del sistema Event Order Flow, y no se cambió renderer global, contrato de .lfproj, NodeRegistry, Player ni exportación.
- Prueba de rendimiento objetivo en CPU Pentium Silver N5030/4 GB, 1280×720, 1 y 10 emisores durante 60 s, queda pendiente del Gate de integración y QA local; no se falsifican cifras.

**Evidencia necesaria del usuario:** salida de los comandos, versión del Chromium, reporte de test WebGL, errores de consola si aparecen, compilación Editor/Player. Conservar cambios y proyecto original; no cerrar G001 sin evidencia.
