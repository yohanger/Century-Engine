# LevelForge — LF-MESH-INTEGRATION-QA-G001 · QA de integración geométrica

**Autorización exacta:** `Listo. LF-MESH-INTEGRATION-QA-G001 autoriza comenzar` (2026-10-27).  
**SOURCE_BASELINE de entrada:** `LevelForge_MESH_POLYSHAPE_G001_SOURCE_BASELINE.zip` (814 archivos, ZIP legible).  
**Alcance autorizado:** pruebas de integración, diagnóstico, documentación y actualización del ledger. **Cero cambios en producción.**  
**Estado:** TEST AUTOMATIZADO PASS; **BUILD, ELECTRON, JOLT en ejecución, Player, guardado visual y exportación real NO VERIFICADOS**. Gate y Sprint **PENDIENTES de QA local**, no cerrados.

## 1. Qué se comprobó realmente

Ejecución en Node.js v22.16.0 desde una copia aislada del SOURCE_BASELINE:

| Evidencia | Comando | Resultado |
|---|---|---|
| Integración geométrica específica | `node --test scripts/test-mesh-integration-g001.mjs` | **15 PASS / 0 FAIL / 0 SKIP** |
| Regresión Node (sin Starcat) | `find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' -print0 \| xargs -0 node --test` | **1479 PASS / 0 FAIL / 18 SKIP** (1497 pruebas contabilizadas) |
| Sintaxis del runner nuevo | `node --check scripts/test-mesh-integration-g001.mjs` | **PASS** |
| Compilación Editor + Player | `npm run build` | **NO VERIFICADA**: `sh: 1: vite: not found`, salida 127 |

`test-starcat.mjs` queda fuera de la regresión por falta de dependencias externas del entorno. **No** se registró como PASS. No se instalaron dependencias del proyecto y no se simularon resultados de Electron/Jolt/GPU.

### Matriz de pruebas INT-01..15

- **INT-01:** Generador Vértice → cadenas → Fill → extrusión de sólido y volumen cerrado.
- **INT-02:** Contorno cóncavo → triangulación → buffers renderizables y puntos trimesh consistentes.
- **INT-03:** Cierre inválido sin mutación de geometría ni selección. Se excluye `rev` de la comparación porque `toJSON()` genera una revisión nueva al serializar: no constituye un cambio en la topología.
- **INT-04:** Reconstitución de datos desde snapshots de geometría y selección; **no** prueba el historial Undo/Redo real de EditSession.
- **INT-05:** UV, colores y pesos tras serialización/deserialización.
- **INT-06:** Buffers Blockout con escala: longitud, índices y valores finitos.
- **INT-07:** Correspondencia de triángulos render y trimesh con la misma escala.
- **INT-08:** Compatibilidad con JSON de mallas anteriores, sin atributos opcionales.
- **INT-09:** Extrude convencional sin tapa inferior vs. sólido cerrado con tapa.
- **INT-10:** Roundtrip de objeto `mesh` y selección normalizada, **no** guardado a disco de `.lfproj`.
- **INT-11:** Inspección estructural de rutas `EditSession` → nodo mesh → Jolt, **no** ejecución de Player.
- **INT-12:** Inspección estructural de exportador Godot compartido; **no** archivo exportado ejecutado.
- **INT-13:** Catálogo Vértice utiliza el tipo `mesh`, sin segundo nodo.
- **INT-14:** Las caras previamente existentes permanecen intactas tras rellenar un contorno adicional.
- **INT-15:** Selección de vértices conserva adyacencias de aristas correctas.

## 2. Hallazgos y límites

**OBSERVADO:** el núcleo PolyMesh, operaciones de construcción, buffers y funciones de serialización superaron las 15 pruebas de integración nuevas. El SOURCE_BASELINE conserva las rutas `src/engine/runtime/nodes/mesh.js`, `src/engine/runtime/physics/jolt.js` y `src/core/godot/nodes.js`, que consumen datos de la misma malla. La regresión ejecutada no produjo fallos.

**OBSERVADO:** Vite no está disponible en el entorno usado, por lo que el comando de build no se completó.

**INFERENCIA, NO DEFECTO DEMOSTRADO:** podrían existir diferencias en control de cámara, overlays, material/shader, física GPU/Jolt, serialización de un proyecto real o exportación en ejecución. Son riesgos a cubrir con QA local, no causas raíz identificadas.

**CAUSA RAÍZ DE IMPOSIBILIDAD DE COMPILAR AQUÍ:** la dependencia ejecutable `vite` no estaba instalada en esta copia; esto no demuestra un fallo del código ni del `package-lock.json`.

Sin fallos funcionales de producción confirmados por esta campaña de tests. El alcance autorizado no permite introducir correcciones de producción; todo fallo posterior necesitará evidencia, auditoría de causa raíz y Gate de corrección separado.

## 3. Preparación y comandos para QA local (usuario)

1. Conservar la instalación principal, proyectos y cambios locales. Extraer el **SOURCE_BASELINE del presente Gate** en una carpeta de prueba vacía, por ejemplo `~/DEV/LevelForge_MeshIntegration_QA/`. La raíz descomprimida debe incluir `package.json`, `src/`, `scripts/`, `docs/`.
2. Desde la raíz descomprimida, instalar dependencias con `npm ci`. Registrar el resultado; si falla, no continuar hasta diagnosticar el error.
3. Ejecutar primero `node --test scripts/test-mesh-integration-g001.mjs`, luego `npm run build` y después `npm run electron`.
4. Abrir una copia de escena de prueba y mantener intacto cualquier proyecto histórico de trabajo.

**Esperado:** el test nuevo registra 15 PASS; Vite compila Editor y Player sin errores; `npm run electron` abre el editor. El resultado de esos dos últimos pasos no se afirma aquí: requiere log del usuario.

## 4. Lista de QA de integración en Editor / Player

| ID | Acción manual | Esperado | Estado actual |
|---|---|---|---|
| INT-LOCAL-01 | Insertar primitiva Vértice, colocar cuatro puntos y cerrar contorno | Se ve la arista de cierre, sin superficie automática | [ ] PENDIENTE |
| INT-LOCAL-02 | Usar Fill en contorno convexo y después cóncavo en L | Superficies sin huecos falsos ni triángulos cruzados | [ ] PENDIENTE |
| INT-LOCAL-03 | Extruir con **Sólido cerrado** y examinar arriba, lados e inferior | Volumen completo, normales consistentes | [ ] PENDIENTE |
| INT-LOCAL-04 | Editar vértices/aristas/caras, deshacer y rehacer | Geometría, selección y materiales coherentes | [ ] PENDIENTE |
| INT-LOCAL-05 | Aplicar Snap/Blockout y material incluido y compartido | Medidas, UV y materiales preservados | [ ] PENDIENTE |
| INT-LOCAL-06 | Guardar escena `.lfproj` y reabrirla desde disco | Malla, material, UV y edición iguales | [ ] PENDIENTE |
| INT-LOCAL-07 | Colisión estática trimesh en Play con jugador/objeto | Sin atravesar cara de colisión válida | [ ] PENDIENTE |
| INT-LOCAL-08 | Ejecutar Player separado y juego exportado existente | Misma geometría renderizada y colisionable | [ ] PENDIENTE |
| INT-LOCAL-09 | Exportar por el flujo existente a Godot y abrir el resultado | Recurso malla/colisión correcto, sin pérdida de volumen | [ ] PENDIENTE |
| INT-LOCAL-10 | Abrir proyecto anterior con malla editada y Extrude clásico | Sin cambio funcional ni visual | [ ] PENDIENTE |
| INT-LOCAL-11 | Dibujar contorno inválido y confirmar que Fill no corrompe nada | Error visible y malla intacta | [ ] PENDIENTE |
| INT-LOCAL-12 | Repetir con escena grande y varios contornos | Sin congelamiento ni degradación grave | [ ] PENDIENTE |

**Evidencia requerida:** logs completos de `npm ci`, `npm run build` y test; capturas/vídeo de los pasos INT-LOCAL-01..06 y 11; logs/captura de la colisión Jolt, Player y exportación; evidencia de compatibilidad anterior. Diferenciar resultados de Editor y de Player exportado. No marcar ningún INT-LOCAL como PASS sin evidencia.

## 5. Gestión de cierre

- **TEST AUTOMATIZADO PASS:** confirmado sobre los tests aquí enumerados.
- **COMPILADO:** NO VERIFICADO.
- **QA LOCAL PASS:** NO VERIFICADO.
- **APROBADO:** autorización de ejecución recibida, **aceptación técnica final todavía pendiente**.
- **CERRADO:** NO.

El cierre del Sprint geométrico se evaluará **después** de recibir QA local, corregir defectos con Gate específico cuando proceda, registrar evidencias reales y obtener aprobación explícita. Las mejoras paramétricas de Escalera pertenecen a un Sprint distinto.
