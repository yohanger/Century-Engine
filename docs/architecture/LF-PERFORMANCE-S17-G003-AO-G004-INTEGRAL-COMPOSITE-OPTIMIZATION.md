# S17 — AO-G004 · Optimización experimental de composición AO

**Gate autorizado:** `Listo. LF-PERFORMANCE-S17-G003-AO-G004-INTEGRAL-COMPOSITE-OPTIMIZATION autoriza comenzar`

**SOURCE_BASELINE precedente:** `LF_PERFORMANCE_S17_G003_AO_G003_INTEGRAL_COMPOSITE_SCENE_DIAGNOSIS_SOURCE_BASELINE.zip`.

**Autoridad:** CA-001 VISUAL-FIDELITY-FIRST y CA-002 OPTIN-EXPORT-DIAGNOSTICS ratificadas; contratos AO-G001/G002/G003 vinculantes. G003 con QA local visual de instrumentación, sin aprobación/cierre formal. G002 con QA parcial. Este Gate no cambia sus estados.

## Auditoría real y decisión

`GTAOPass` de Three.js r186.1 (`node_modules/three/examples/jsm/postprocessing/GTAOPass.js`) para `OUTPUT.Default` dibuja `_renderPass` dos veces sobre la salida: copia `readBuffer.texture` usando `CopyShader` sin blending y, después, multiplica la salida por el `pdRenderTarget.texture` mediante `GTAOBlendShader` y `CustomBlending` (`DstColorFactor`, `ZeroFactor`; alpha `DstAlphaFactor`, `ZeroFactor`). La composición es a resolución completa independientemente de la escala de buffers GTAO.

**Optimización experimental:** un único `ShaderMaterial` local, administrado por `LookPipeline`, muestrea `readBuffer.texture` y el resultado filtrado del mismo `GTAOPass`, y escribe directamente `vec4(scene.rgb * mix(vec3(1.0), ao.rgb, intensity), scene.a * ao.a)` sin mezcla adicional. Esta expresión reproduce algebraicamente la multiplicación de RGB/alpha anterior para el caso normal, con posibles diferencias de cuantización/redondeo de GPU que requieren inspección visual. Se conserva el método `_renderPass` oficial y todos los pases de oclusión y denoising, sin alterar muestras (16 + 16), perfiles, el orden ni las opciones de render del proyecto.

**Restricciones y condiciones de seguridad:** solo Stats puede elegir `native` o `fused`. El valor inicial es `native`; cerrar Stats devuelve a `native` y restaura AO 100 %. El experimento se usa solo con el `OUTPUT.Default` y texturas/buffers válidos; otros modos usan el recorrido original. Los métodos temporales del addon se restauran mediante `finally` incluso si el render lanza una excepción. El material adicional se libera al disponer el mismo `GTAOPass`. No se ha añadido un segundo pipeline ni modificado código de terceros, menú Build, configuración serializada ni permisos de AppImage. La opción solo está disponible en un Player exportado cuando NGME-STATS está permitido.

## Instrumentación

`PerfMonitor` conserva las métricas `AO · copia`, `AO · mezcla` y `AO · composición` en modo original, y registra `AO · fusión` en el alternativo. Las filas detalladas se excluyen de la suma de GPU para evitar doble contabilización. El cambio de modo descarta consultas anteriores y reinicia estadísticas. `Escena · dibujo` y `Escena · limpieza` permanecen disponibles, junto a la resolución del buffer de escena, draw calls y triángulos, para el diagnóstico por dependencia de resolución. Sin GPU real no puede saberse si el pase fusionado es más barato ni si `Escena · dibujo` está limitado por fragmentos, materiales, geometría o ancho de banda.

## Limitaciones e hipótesis

- OBSERVADO en video AO-G003: `AO · copia` y `AO · mezcla` consumen varios ms y `Escena · dibujo` continúa elevado. Encadres y condiciones no controlados; no son porcentajes comparables de mejora.
- INFERENCIA fundamentada en la fuente de Three.js: eliminar una pasada de pantalla completa podría reducir tráfico de lectura/escritura del framebuffer, pero el shader fusionado incorpora una muestra adicional de textura; el efecto neto depende de GPU y controlador.
- CAUSA RAÍZ del coste completo de `Escena · dibujo`: NO VERIFICADA. Se propone barrido de resolución con cámara fija y AO constante; sin resultados no se alteran shaders de escena, materiales, iluminación ni geometría.
- GLSL / renderizado real / equivalencia visual / builds Editor-Player: NO VERIFICADOS en entorno asistido. Pruebas Node con mocks no garantizan render en WebGL2 ni performance en Intel UHD 605.

**Fuentes de contraste oficial:**
- https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/GTAOPass.js
- https://github.com/mrdoob/three.js/blob/r186/examples/jsm/shaders/GTAOShader.js
- https://github.com/mrdoob/three.js/blob/r186/examples/jsm/shaders/CopyShader.js

**Estado:** IMPLEMENTADO EXPERIMENTAL; TEST AUTOMATIZADO PASS; BUILD NO VERIFICADO; QA LOCAL PENDIENTE; NO APROBADO; NO CERRADO.
