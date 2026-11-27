# LF-BLOCKOUT-S01-G001 — Blockout métrico de autoría

**Autorización exacta:** `Listo. LF-BLOCKOUT-S01-G001 autoriza comenzar` (2026-10-26).  
**SOURCE_BASELINE de entrada:** `LevelForge_HUB_TEMPLATES_S01_G001_CORR_001_SOURCE_BASELINE.zip` (790 entradas). Este baseline procede del Hub correctivo, que sigue pendiente de verificación visual en Electron.

## 1. Objetivo

Mantener superficies grises con cuadrícula negra de **1 metro**, mostrar las medidas en metros y reiniciar el origen métrico **por cara nueva** tras Edit Mesh (Extrude/Inset/cortes/subdivisiones), con mínima carga gráfica y sin sobrescribir las UV artísticas del proyecto.

## 2. Contrato técnico implantado

- **Métrica geométrica, no artística:** el módulo `mesh/blockout-metrics.js` calcula un sistema bidimensional independiente por cara a partir de los vértices reales y la escala local de objeto. Su origen es la esquina mínima de esa cara, con longitud y altura en metros. Una traslación o rotación del objeto no modifica la dimensión. Las caras creadas tras extruir se evalúan de nuevo y no heredan el desplazamiento UV de las originales.
- **Geometría normal de PolyMesh:** `polyBuffers()` emite atributos `lfBlockUV` y `lfBlockSize` **solo cuando se solicita Blockout**. Conserva `uv`, colores y pesos existentes; las versiones JSON de PolyMesh no reciben un estado nuevo. En mallas suavizadas, la geometría de Blockout utiliza vértices de cara separados para representar correctamente las costuras métricas.
- **Primitivas planas:** cubo, plano, rampa y escalera reciben una copia individual de sus buffers, sin alterar los buffers compartidos en caché; cada superficie coplanar comparte una referencia métrica. La escala del nodo recalcula las medidas. Conos, cilindros y esferas conservan el Blockout triplanar anterior, sin etiquetas bidimensionales por cara curvada, que serían engañosas.
- **Material PBR existente:** el shader `builtin:blockout` utiliza los nuevos atributos de cara cuando están disponibles y un mapa Albedo no lo sustituye. Si no hay atributos métricos (por ejemplo, geometría heredada de terceros), permanece el patrón triplanar compatible. Los materiales y shaders no Blockout no utilizan atributos extra.
- **Referencias negras:** líneas procedurales antialias de 1 m. No se generan subdivisiones, objetos o draw calls individuales por cada cuadrícula.
- **Etiquetas métricas:** atlas tipográfico compartido, generado una vez con CanvasTexture, para mostrar **`METROS: 100 X 4`** (ancho por altura, redondeados al metro). La leyenda se integra en el shader, una vez en el origen de cada cara. En caras pequeñas (`< 3 m` de ancho o `< 0,55 m` de alto) se omite el texto para no saturar la imagen; la cuadrícula de 1 m permanece. No es una cota de ingeniería con decimales exactos: las medidas más precisas se obtienen de la geometría.
- **Edición en vivo:** `EditSession._rebuildBody()` reconstruye también atributos métricos durante cambios de malla; el Player y el Editor utilizan las mismas rutas de render del nodo.
- **Persistencia:** el cálculo es derivado de geometría y escala; no se añade un recurso de material obligatorio ni se cambian las UV guardadas. La sustitución por Albedo y por otros materiales conserva el comportamiento anterior.

## 3. Pruebas automatizadas

```bash
node --test scripts/test-blockout-s01-g001.mjs
```

La suite cubre: panel de 100 × 4 m, traslación, escala, rotación, extrusión de 3 m, referencias propias de las nuevas caras, subdivisión real de una cara, preservación de UV, atributos por esquina, compatibilidad JSON, geometría degenerada, continuidad entre triángulos coplanares, shader compartido, edición en vivo, fallback Albedo y reutilización del runtime.

**Resultado final de suite:** 19 PASS / 0 FAIL.  
**Regresión acumulada:** 1325 PASS / 0 FAIL / 18 SKIP (excluye el test opcional `test-starcat.mjs`, que requiere `three` instalado en este entorno).  
**Compilación Editor + Player:** `npm run build` NO VERIFICADO (`vite: not found`, sin `node_modules`).  
**Render WebGL/GLSL en hardware real:** **NO VERIFICADO**. La comprobación estática y las pruebas Node no equivalen a aceptar el aspecto visual ni el rendimiento.

## 4. QA manual obligatorio en Linux / Electron / Player

- [ ] Crear un cubo y escalarlo a 100 × 4 × 1 m; verificar líneas negras cada 1 m y una etiqueta legible **METROS: 100 X 4** en la cara correspondiente.
- [ ] Entrar en Edit Mesh, extruir 3 m la cara grande; comprobar las cuatro caras laterales con cuadrícula que empieza de nuevo y una dimensión de 3 m en las etiquetas correspondientes.
- [ ] Subdividir, cortar e insertar una cara, mover vértices, aplicar Inset/Bevel; verificar ausencia de deslizamiento de la cuadrícula y que la medida se actualiza sin modificar UV artísticas.
- [ ] Escalar y rotar el objeto, moverlo en el mundo y comprobar la métrica; probar igualmente malla hija de objeto padre transformado, registrar diferencias si existen.
- [ ] Sustituir el Albedo por una textura real, deshacer y devolver Blockout: no debería romper UV, colores, pesos ni materiales existentes.
- [ ] Comprobar cubo, rampa, plano, escalera; observar que superficies curvas de esfera/cilindro usan fallback triplanar sin medida plana engañosa.
- [ ] Guardar/reabrir escenas y reabrir un proyecto antiguo. Comprobar la misma imagen en Player exportado (Forward+, Mobile y Compatibility).
- [ ] Revisar rendimiento en escenas con cientos de caras y superficies largas: FPS, VRAM y estabilidad de GLSL en la iGPU.
- [ ] Verificar que no existe error de WebGL y que las etiquetas son legibles sin artefactos durante orbitado/zoom.

## 5. Límites conocidos y dependencias futuras

- La medida deriva de la **escala local**. Jerarquías con escala no uniforme en padres y deformaciones tipo shear requieren QA específico de transformación mundial; no se certifica precisión total bajo tales casos.
- Las etiquetas redondean a metros, no a centímetros. No reemplazan herramientas de medición o acotación profesional.
- El shader y atlas necesitan GPU/WebGL; el test automatizado no garantiza compatibilidad visual/GLSL en la máquina real.
- No se reorganizó el Inspector al estilo Godot; ese trabajo queda para `LF-MATERIAL-UX-S01-G001`. Tampoco se modificaron Colliders ni los ajustes Snap de Escena.
- No se creó un segundo material ni una jerarquía paralela de UV. La política EXTEND BEFORE DUPLICATE se mantiene.

## 6. Política de entrega

Exactamente dos ZIP: **CHANGE** (archivos nuevos/modificados del Gate, pruebas, documentación y ledger) y **SOURCE_BASELINE** (proyecto acumulado completo). Sin archivo SHA independiente ni scripts `.sh`; excluir `node_modules`, `dist`, builds, logs y temporales. La comparación es contra el baseline Hub mencionado arriba.
