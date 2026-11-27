# S17-G003 — Integración de diagnóstico opt-in y auditoría de AO

**Gate:** `LF-PERFORMANCE-S17-G003-INTEGRAL-AO-AND-DIAGNOSTICS`  
**Autorización:** recibida mediante declaración exacta.  
**Contract Amendment:** CA-002 ratificada, vinculante.  
**Base:** S17-G002 SOURCE_BASELINE intacto al inicio de la intervención.

## OBSERVADO — código previo
- `src/core/commands.js` anuncia F3 como «Rendimiento», pero `src/core/editor/keys.js` no tenía caso F3. En PlayMode, `play-controls.js` consumía los eventos de teclado antes de llegar al Editor.
- `electron/player/main.cjs` fija `webPreferences.devTools = false`. No había permisos de diagnóstico ni capa de visualización de F3 en el Player exportado.
- `electron/appimage.cjs` ya empaqueta `config.json`; `src/core/state/game.js` ya transporta opciones por la exportación. La ventana `ExportGameModal.vue` no las ofrecía.
- `src/components/PerfPanel.vue` ya visualiza `PerfMonitor`, pero obtenía el monitor desde el store editorial, innecesario en el Player. `PlayerApp.vue` ya administra el ciclo de vida del `GameGraph` y puede montar el componente.
- La captura aportada por el usuario muestra **16 FPS**, **58,7 ms GPU total** y **28,7 ms de AO**, aproximadamente 48,9 % del tiempo GPU informado. Es UNA muestra de un solo estado y equipo: no una medición antes/después ni una causa raíz completa.
- El pipeline usa `GTAOPass` oficial de Three.js con 16 muestras AO y 16 de denoising. Con escala interna reducida, el AO se procesa en el `composerA`; sin división, se procesa en el compositor único. Su propietario es `render/look.js`.

## IMPLEMENTADO — mecanismo permitido
1. F3 se procesa en el Editor antes del retorno temprano de PlayMode; se mantiene el rechazo cuando la edición de texto tiene foco. `play-controls.js` deja pasar F3 al Editor, sin afectar el input del juego exportado.
2. `store.gameExport.diagnostics` es estado efímero. Al abrir Build se ponen las opciones en `false`; no se marca el proyecto como modificado.
3. Se trasladan dos booleanos validados al proceso de exportación. `config.json` de AppImage normal no contiene `diagnostics`.
4. En el proceso Player `devTools` solo se habilita si `config.diagnostics.devtools === true`. El monitor solo se conmuta si `config.diagnostics.stats === true`. No hay overrides por `GAME_DEVTOOLS`, modo desarrollo ni flags externos.
5. IPC únicamente para recuperar el permiso Stats desde el frame propio y recibir la señal de conmutación en el propio Player. Sin APIs remotas, sin Node en el renderer y sin cambiar el almacenamiento del juego.
6. `PerfPanel.vue` ahora recibe `monitor`, `playing` y `redraw`; tanto Editor como Player usan el mismo componente. Se conserva el control de `PerfMonitor.enable()` solo mientras el panel está visible.

## AO — estado de la investigación
No se modificó `GTAOPass`, su número de muestras ni el esquema de render. No hay evidencia experimental en UHD 605 que sustente una reducción de muestras, un nuevo método de denoise o una mejora de FPS. Este Gate entrega **la vía de diagnóstico exportada** necesaria para medir AO en el juego real. Reducir la calidad a ciegas contradiría CA-001 VISUAL-FIDELITY-FIRST.

**HIPÓTESIS A VALIDAR:** AO representa un coste importante en esta escena de prueba y podría ofrecer oportunidades al ajustar el cálculo o evitar procesar píxeles que no contribuyen al resultado. No atribuir a `GTAOPass` un fallo universal. Solo medir en mismas condiciones y conservar una optimización si el GPU p50/p95 y la calidad de imagen muestran una ventaja.

## Fuera de alcance
No se añadieron controladores, gestores de render, temporales TAA, algoritmos de reescalado, plugins Unity, permisos adicionales ni cambios a Database/Jolt/sistema de guardado. Ningún archivo de juegos del usuario fue alterado.

## Limitaciones de verificación
Pruebas Node con dobles PASS; `npm run build` falla `vite: not found`; compilación Vue, WebGL2 real y AppImage ejecutado **NO VERIFICADOS**. Los fallos de la antigua suite de distribución también se reproducen en G002; no se marcarán como solucionados. QA local según documento adjunto.
