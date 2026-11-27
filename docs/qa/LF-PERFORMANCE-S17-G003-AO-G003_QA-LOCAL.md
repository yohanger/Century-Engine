# QA local — S17-G003 AO-G003

## Preparación y aislamiento

1. Extraer `LF_PERFORMANCE_S17_G003_AO_G003_INTEGRAL_COMPOSITE_SCENE_DIAGNOSIS_SOURCE_BASELINE.zip` en carpeta **nueva**, raíz con `package.json`. No aplicar CHANGE sobre ella. Conservar G002 y proyectos locales; no reemplazarlos sin comparación.
2. Usar `npm ci`, `node --test scripts/test-performance-s17-g003-ao-g003-composite-scene-diagnosis.mjs`, ejecutar la selección focal documentada en evidence/02 y `npm run build`, `npm run electron` desde raíz.
3. Esperado: 11/11 tests nuevos PASS, 65/65 focal PASS. El Editor y el Player de este Gate deben compilar localmente, pendiente de evidencia. Las advertencias no son FAIL automáticamente.

## Comparación A/B/C/D: misma escena, cámara inmóvil

1. Una escena con suelo, paredes, objetos apoyados, cielo; Render realista Alto. Anotar tamaño de ventana, resolución física, resolución interna del juego, perfil, AO radio/intensidad, MSAA, niebla, sombras y GPU. Mantener fijo el encuadre de terreno; F3 abre Stats.
2. Registrar **AO 100%**, después **75%**, después **50%**, y finalmente **AO desactivado** (en ajustes Render; implica reconstrucción del compositor). Tras cada cambio dejar estabilizar, reiniciar medias y realizar tres corridas de ~60s. Repetir la serie con cámara fija al cielo, sin comparar terreno y cielo como si fueran el mismo benchmark.
3. Por corrida capturar: FPS, frame p50/p95, `GPU · pasadas`, `AO · total`, `AO · G-buffer`, `AO · oclusión`, `AO · denoise`, `AO · composición` y **detalle `AO · copia`, `AO · mezcla`, `AO · preparación de salida`**; `Escena · dibujo`, `Escena · limpieza`, `Escena · resto`, `Sombras`; buffer escena/GTAO/composición; retraso consultas GPU; draw calls, triángulos.
4. Comprobar que la suma de `AO · copia + AO · mezcla + AO · preparación de salida` coincide aproximadamente con `AO · composición` (estadísticas de igual ventana). Las filas de detalle NO deben elevar `GPU · pasadas` porque no se suman dos veces.
5. Verificar que Stats abierto/cerrado no altera la imagen, que pasar 100/75/50 no cambia la cámara, que cerrar F3 restituye AO 100%, que un resize no desajusta texturas y que la calidad visual 100% conserva contactos (capturas PNG A/B/C). Restablecer AO a su valor original tras OFF.
6. AppImage **solo con NGME-STATS autorizado en Build**: `Ctrl+Shift+F3`, repetir medidas en Player, comprobar que AppImage normal bloquea Stats y DevTools. No habilitar permisos adicionales para el QA de AO.

## Diagnóstico e interpretación

- `Escena` sin desglosar no se compara directamente con `Escena · resto`. En la versión instrumentada distinguir dibujo, limpieza y sombras externas. La composición GTAO copia y luego mezcla sobre la salida, aunque el cielo no requiera oclusión.
- Resultados del temporizador GPU pueden llegar varios fotogramas después. Registrar `Retraso consulta GPU` y descartar resultados bajo disjoint, calentamiento, redimensionamiento o cambio de perfil.
- Un descenso del tiempo de AO NO demuestra aumento de FPS ni equivalencia visual. No declarar causa raíz definitiva sin A/B reproducible y datos con cámara fija.

## Evidencia a devolver

Log de 11 tests, log de build Editor + Player, capturas PNG de cada modo con Stats y cámara fija (3 corridas representativas por variante), una vista de AO con cielo, AppImage opt-in y normal, más cualquier error WebGL/Electron y capturas del defecto. El QA local lo ejecuta el usuario; no se declara PASS sin su evidencia. Mantener el SOURCE_BASELINE de este Gate para continuación solo cuando se considere válido y corregido.
