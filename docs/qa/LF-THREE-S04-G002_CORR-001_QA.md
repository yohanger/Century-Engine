# LF-THREE-S04-G002_CORR-001 — Corrección del render con Outline y Lensflare

**Autorizado:** `Listo. LF-THREE-S04-G002_CORR-001 autoriza comenzar` (2026-10-25).  
**Fuente:** `LevelForge_THREE_S04_G002_SOURCE_BASELINE.zip` (718 archivos; ZIP íntegro).  
**Estado:** CORRECCIÓN IMPLEMENTADA EN FUENTE; QA WebGL en equipo del usuario y aceptación **PENDIENTES**.

## Evidencia recibida

- Captura: Editor mantiene paneles, pero viewport de escena aparece negro; el usuario indica que el render queda congelado.
- Consola: `Cannot set properties of null (setting 'enabled')`, originado en el render; se repite también en `ResizeObserver`.
- Consola: repetición de `GL_INVALID_OPERATION: glCopyTexSubImage2D: Invalid operation on multisampled framebuffer`.
- Las advertencias de CSP de Electron, `toNonIndexed()` y `slider-vertical` no son la causa del error `.enabled`.

## Causa 1 — demostrada por código y prueba de reproducción

Al seleccionar el estilo **Outline** en modo Clásico o en perfil Bajo, `LookPipeline._buildSingle()` construye solo `RenderPass + OutputPass + OutlinePass`. `volPass` y `atmoPass` permanecen `null`. En `LookPipeline.render()` se modificaba incondicionalmente `.enabled` de ambos, provocando la excepción. La corrección valida la existencia de cada pase antes de actualizarlo. El resto de la lógica de niebla para compositor completo se mantiene sin cambios.

**Pruebas CORR-01, CORR-02 y CORR-03:** ejercitan **la implementación real de la clase** con compositor mínimo y completo mediante un renderer de prueba; reproducen las rutas que faltaban en el QA previo (no solo expresiones regulares).

## Causa 2 — operación WebGL incompatible identificada; resultado GPU pendiente

El addon Lensflare r170 utiliza `renderer.copyFramebufferToTexture()` en su `onBeforeRender` (dos veces por fuente) para calcular oclusión. WebGL no admite la operación `glCopyTexSubImage2D` directamente desde un framebuffer **multisample**. `LookPipeline` utilizaba `samples: 4` en su buffer de escena principal y en A del modo dividido.

**Corrección acotada**: el framebuffer donde la escena (y, por tanto, Lensflare) se representa usa `samples: 0` **únicamente cuando un Lensflare es visible**. Cuando no hay flares, los buffers de escena conservan las 4 muestras MSAA normales, y el target B del modo dividido permanece intacto. La detección usa `scene.traverseVisible()`; el `builtKey` del compositor incluye estado de flare para recrearlo únicamente al aparecer o desaparecer un flare visible. No se modifica el antialias global de `WebGLRenderer`, el cielo, WATER ni los addons de Three.js.

**Limitación:** mientras hay Lensflare visible, se pierde MSAA solo en el buffer de escena correspondiente. Puede disminuir la suavidad de bordes; además hay un recorrido de visibilidad de escena durante el renderizado para detectar cambios. Este compromiso requiere confirmación de coste y calidad en Intel UHD 605. Se conserva el addon oficial, su oclusión y el comportamiento de luces antiguas. No se ha verificado todavía en una GPU que las advertencias desaparezcan por completo.

Referencia precisa del addon: https://github.com/mrdoob/three.js/blob/r170/examples/jsm/objects/Lensflare.js

## Evidencia automática en entorno de entrega

| Prueba | Resultado |
|---|---|
| `node --test scripts/test-three-s04-g002-corr-001.mjs` | **10 PASS, 0 FAIL, 1 SKIP** (real Three.js ausente) |
| `node --test` de suites `scripts/test-*.mjs` excepto `test-starcat.mjs` | **828 PASS, 0 FAIL, 14 SKIP** |
| `node --check` en código afectado y suite | PASS |
| `npm run build` | **NO VERIFICADO**, `vite: not found` |
| Render WebGL, Editor, PSX, juego Player exportado | **NO VERIFICADO** |

La suite `test-starcat.mjs` no es ejecutable en esta copia sin `three` instalado. Los 14 SKIP no equivalen a PASS. El bug inicial se confirma en el código fuente y las pruebas simuladas; el cierre funcional requiere el QA del usuario.

## QA obligatorio del usuario — regresión visual y de GPU

- [ ] Comparar archivos cambiados con tus cambios locales antes de extraer CHANGE. Respaldar archivos con cambios no reconciliados.
- [ ] Ejecutar `node --test scripts/test-three-s04-g002-corr-001.mjs` y `npm run build` (Editor y Player). Comprobar compilación completa, sin errores.
- [ ] En Editor, con Clásico o calidad Baja, activar **Preferencias → Selección → Contorno**, seleccionar Spawn y Cubo; mover cámara y redimensionar viewport. **No** debe reaparecer el `TypeError: ... enabled` y la escena debe renderizarse.
- [ ] Alternar Caja / Contorno / Ninguno; comprobar selección simple, múltiple, borrado, gizmos, perspectiva y ortográfica.
- [ ] Con Lensflare **OFF**, confirmar que el render conserva su calidad MSAA anterior; verificar que SSR, LUT, DOF, AO, Bloom, niebla, cielo, WATER no han cambiado.
- [ ] Activar Lensflare en PointLight o SpotLight y mirar/mover la cámara a través de obstáculos. Comprobar que **no aparece** `GL_INVALID_OPERATION: glCopyTexSubImage2D...` ni render negro.
- [ ] Activar a la vez Lensflare y Outline en Clásico, Realista y perfil Bajo/Medio/Alto. Probar SSR ON/OFF y modo PSX. Observar bordes y rendimiento; si aparecen artefactos, guardar captura y registro.
- [ ] Desactivar Lensflare otra vez y verificar que se recupera la calidad de bordes de la ruta con MSAA sin reiniciar.
- [ ] Iniciar Play Mode y volver al Editor: Outline editorial desaparece en Play y reaparece cuando corresponde; Lensflare conserva su estado.
- [ ] Verificar juego **exportado**: no contiene selección editorial; no hay errores WebGL con Lensflare y conserva la escena de juego.
- [ ] Registrar la consola **después** de la corrección y métricas comparables con Lensflare OFF/ON y Outline Caja/Contorno; sin prometer FPS.

## Entrega y continuidad

Dos ZIP exactamente: `LF-THREE-S04-G002_CORR-001_CHANGE.zip` y `LevelForge_THREE_S04_G002_CORR_001_SOURCE_BASELINE.zip`. Sin SHA independiente, sin scripts `.sh`, sin `node_modules` ni builds. No continuar con S05 hasta que el usuario confirme el QA y apruebe esta corrección.
