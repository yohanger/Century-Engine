# LevelForge — LF-MESH-POLYSHAPE-G001: PolyShape desde vértices

**Autorización exacta recibida:** `Listo. LF-MESH-POLYSHAPE-G001 autoriza comenzar` (2026-10-26).  
**Entrada:** `LevelForge_MESH_VERTEX_G001_SOURCE_BASELINE(1).zip` (812 entradas).  
**Estado:** IMPLEMENTADO, TEST AUTOMATIZADO PASS. **BUILD, QA LOCAL, GPU, Player y exportación NO VERIFICADOS**. No aprobado ni cerrado.

## 1. Contrato y diseño

- [X] Cierre de una cadena de aristas sueltas desde un extremo seleccionado, dentro de `PolyMesh.we`. No crea caras automáticamente.
- [X] Fill desde el punto activo del bucle cerrado; mantiene el orden de las aristas para concavidades. También admite selección de todas las aristas o vértices del contorno.
- [X] Antes de Fill comprueba índices/puntos, distancias, área, coplanaridad y autointersecciones. Rechaza la cara duplicada y operaciones inválidas sin dejar mutaciones parciales.
- [X] `triangulateFace()` deja de fabricar un abanico cuando no puede completar el recorte de orejas; omite triángulos inválidos. Los polígonos históricos válidos mantienen su triangulación.
- [X] `Extruir` convencional NO cambia de modo. `Sólido cerrado` amplía `extrudeRegion()` con la tapa inferior invertida y aristas laterales normales, solo para un parche de caras aislado, coplanar, conectado y sin agujeros.
- [X] Altura cero o desplazamiento contrario a la normal bloqueados al confirmar la operación de sólido en el modal. Para extruir en el otro sentido, invertir normales primero.
- [X] Se conserva el nodo `mesh`, Undo/Redo mediante `EditSession.run()/commit()`, UV y atributos mediante `reconcileAttributes()`, buffers, materiales, Snap y serialización. No hay un segundo editor ni un formato de geometría paralelo.
- [X] `MeshPanel.vue` y `commands.js` reutilizados. No se agregan dependencias.

**Restricciones deliberadas:** este Gate no permite sólidos con agujeros, parches no coplanares, contornos autointersecados ni aristas compartidas con caras externas. Estos casos emiten error; no se aplica una reparación silenciosa. La extrusión de sólidos usa movimiento modal normal positivo y no modifica las colisiones o sistemas de exportación preexistentes.

## 2. Evidencia automatizada de esta entrega

Ejecutado sobre el SOURCE_BASELINE actualizado:

- `node --test scripts/test-mesh-polyshape-g001.mjs` → **21 PASS / 0 FAIL**.
- `node --test $(ls scripts/test-*.mjs | grep -v 'test-starcat.mjs')` → **1464 PASS / 0 FAIL / 18 SKIP**; 1482 pruebas contabilizadas, incluidas las 21 nuevas.
- `node --check` sobre los módulos JavaScript modificados y el bloque `<script setup>` extraído del Vue: **PASS**.
- `npm run build`: **NO VERIFICADO**; `vite: not found` en el contenedor (dependencias del proyecto no instaladas).
- `test-starcat.mjs` excluido del comando de regresión por su dependencia de Three.js no disponible en el contenedor; no declarar su estado PASS.

Las pruebas Node verifican algoritmos y rutas, no la interacción real de Electron, UV visuales, colisores Jolt, shaders, exportación ni persistencia del proyecto completo a través de la interfaz.

## 3. QA local del usuario (pendiente)

**Preparación:** descomprimir **SOURCE_BASELINE completo** en un directorio de prueba independiente. Conservar el proyecto de producción y sus cambios locales; nunca sobrescribirlos a ciegas. Situarse en la raíz, donde están `package.json` y `src/`.

```bash
npm ci
npm run build
npm run electron:dev
```

**Prueba geométrica:**

- [ ] Añadir → Malla editable → Vértice. Trazar una cadena de 4 puntos. Seleccionar uno de sus extremos; pulsar **Cerrar contorno desde el extremo seleccionado**. Aparece la arista de cierre, pero todavía no existe superficie.
- [ ] Con un vértice del bucle aún seleccionado, pulsar **Rellenar (F)**. Debe aparecer la cara (selección en modo Caras) sin cambiar la geometría dibujada.
- [ ] Seleccionar esa cara; pulsar **Sólido cerrado**. Mover el ratón o introducir `1` y confirmar con Enter. Verificar tapa superior, laterales y tapa inferior; comprobar normales al mirar desde distintos ángulos.
- [ ] Pulsar `Ctrl+Z`/`Ctrl+Shift+Z` y comprobar recuperación de la geometría y atributos. Repetir con Snap activado.
- [ ] Crear una cadena con forma de L (cóncava), cerrarla y rellenarla: la cara no debe tapar el hueco de la L.
- [ ] Trazar una figura cruzada, una cadena con puntos coincidentes o un contorno no coplanar: Fill debe rechazar la operación sin geometría nueva.
- [ ] Extruir la cara mediante el comando **Extruir (E)** existente: no debe aparecer tapa inferior nueva; debe conservar el comportamiento anterior.
- [ ] Hacer **Sólido cerrado** con una cara que comparte arista con otra fuera de la selección: debe mostrar rechazo informativo y no modificar la malla.
- [ ] Comprobar que el modal no confirma sólido de altura 0 ni extrusión opuesta a la normal.

**Integración:**

- [ ] Editar vértices, aristas y caras del sólido mediante gizmos; validar materiales, UV, Blockout y Shader Graph después de guardar y reabrir.
- [ ] Activar colisión `trimesh` (estática), ejecutar Player integrado y comprobar colisión real. Validar un juego exportado mediante flujo existente.
- [ ] Conservar escena histórica y comprobar que no cambió el resultado del Extrude anterior ni los objetos ajenos al Gate.
- [ ] Probar en viewport perspectiva y ortográfico; registrar errores o ralentizaciones con contornos de distinto tamaño.

**Evidencias a devolver:** salida completa de `npm run build`, capturas de contorno antes/después de Fill, sólido mostrando fondo/laterales, escena reabierta, prueba de colisión/Player y errores de consola si aparecen. **No se declarará QA LOCAL PASS ni CERRADO sin estas evidencias y tu aprobación.**

## 4. Entrega y continuidad

Se entregan dos ZIP: CHANGE con únicamente archivos nuevos/modificados del Gate, y SOURCE_BASELINE completo acumulativo. Ninguno incluye `node_modules`, builds, cachés, scripts `.sh` nuevos ni un SHA-256 independiente. El ledger conserva las seis hojas y registra el estado de QA pendiente, no resultados supuestos.

**Siguiente paso tras QA del usuario:** corregir fallos probados dentro de una autorización de corrección, cerrar este Gate solo cuando proceda, después efectuar QA de integración del Sprint antes de considerar Escalera.
