# LF-MESH-EDIT-S02-G001 · Modelado geométrico (Edit Mesh)

**Gate:** autorizado literalmente por el usuario el 26 de octubre de 2026.  
**Baseline de entrada:** `LevelForge_ASSETS_LPKG_G002_SOURCE_BASELINE.zip` (757 archivos).  
**Regla de aceptación:** implementado no equivale a compilado, QA local PASS ni aprobado.

## [X] Alcance implementado

- [X] **Vertex Slide:** desplaza vértices seleccionados sobre aristas conectadas; eje X/Y/Z seleccionable y factor ±0,95. En vértices con varios vecinos, utiliza el vecino con mayor alineación respecto del eje elegido. Rechaza si no hay una arista en esa dirección.
- [X] **Edge Slide:** desliza una **cadena abierta, continua y no ramificada de aristas interiores** sobre los raíles laterales de la malla. Solo opera cuando cada arista seleccionada tiene dos caras y la normal permite resolver un lateral. Rechaza bordes exteriores, bucles, bifurcaciones o raíles insuficientes.
- [X] **Extrude Individual:** reutiliza `extrudeRegion(m, faces, true)` y traslada cada cara por su propia normal. Las caras vecinas no comparten la extrusión resultante.
- [X] **Spin:** extrusión rotatoria para regiones de caras abiertas. Eje local X/Y/Z, centro configurable, ángulo abierto entre -360° y +360° y de 1 a 128 pasos. No hace soldadura automática de extremos ni valida autointersecciones globales; rechaza selección sobre el eje, regiones sin borde, topología no manifold básica y exceso de geometría.
- [X] **Shear:** cizalla de geometría seleccionada según un eje de desplazamiento y otro eje de referencia, desde centroide local, con factor editable.
- [X] Integración mediante `ops.js` / `EditSession.op()` / `session-modal.js`, botones en `MeshPanel.vue`, comandos y menú Malla. Reutiliza `PolyMesh`, selección, commit y Undo/Redo actuales.
- [X] Previsualización editable: escribir un valor, arrastrar el cursor, **Enter** confirmar y **Escape** cancelar. Ninguna operación modal debe confirmar una vista previa inválida.
- [X] Persistencia mediante formato `PolyMesh.toJSON/fromJSON` existente. Ninguna modificación del Runtime de Player ni de Jolt.

## Contrato y limitaciones conscientes

- Las herramientas **no constituyen paridad completa con Blender**. Vertex Slide utiliza dirección de eje; Edge Slide exige cadena abierta interior. No se implementan Slide por superficie arbitraria, Edge Slide circular ni snap de raíles automático para selecciones complejas.
- Spin se centra inicialmente en el origen local `[0,0,0]` y eje Y; cambiar el centro antes de ejecutarlo si la geometría toca ese eje.
- Operaciones de Spin con autointersección, o caras que se solapan por geometría original, requieren inspección visual del usuario. No se incorpora solver geométrico ni remallado.
- La edición de UV, atributos de malla y Vertex Paint permanecen excluidos y sujetos a Gates independientes.

## [X] QA automatizado

- `node --test scripts/test-mesh-edit-s02-g001.mjs`: **24 PASS, 0 FAIL**.
- Regresión secuencial de `scripts/test-*.mjs`, excluyendo `test-starcat.mjs` por dependencias no instaladas: **1037 PASS, 0 FAIL, 18 SKIP**.
- Sintaxis JavaScript: PASS en todos los módulos JS modificados.
- Resultado de las pruebas no demuestra renderizado real ni funcionamiento del viewport.

## [ ] QA local obligatorio

1. [ ] `npm run build` y `npm run electron:dev` en el Linux del usuario con dependencias instaladas.
2. [ ] Vertex Slide sobre un vértice de caja (seleccionar el eje correcto), signo + / - y rechazo informativo sin arista alineada.
3. [ ] Edge Slide sobre una cadena interior de quads, signo inverso y rechazo de borde exterior / bifurcación.
4. [ ] Extrude Individual sobre caras contiguas con normales diferentes: caras efectivamente independientes.
5. [ ] Spin sobre una cara fuera del eje, varios ángulos/pasos y centro personalizado; verificar orientación de las tapas y su geometría.
6. [ ] Shear con cambio de ambos ejes, valores positivos y negativos; comprobar centroide.
7. [ ] Durante una operación, probar valor numérico, Enter, Escape, botón Undo/Redo, guardado/reapertura.
8. [ ] Después de editar, probar colisión trimesh/convex, sombras y Player exportado.
9. [ ] Verificar rendimiento al ejecutar Spin con decenas o centenares de caras.

**Estado de Gate:** IMPLEMENTADO Y TEST AUTOMATIZADO PASS. No afirmar compilación, QA local ni aprobación sin evidencia del usuario.
