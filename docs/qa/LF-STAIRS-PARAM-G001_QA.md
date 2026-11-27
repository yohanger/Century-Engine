# LF-STAIRS-PARAM-G001 — QA de Escalera recta

**Autorización:** «Listo. LF-STAIRS-PARAM-G001 autoriza comenzar» (27-10-2026).

## Alcance implementado

La primitiva existente Escalera admite de **2 a 64 escalones**; el Inspector usa el mismo máximo que el gráfico de eventos. Anchura, altura y profundidad siguen dependiendo de `scale` XYZ. Las entradas fuera de rango se normalizan y el valor ausente conserva ocho escalones.

`stairsGeometry()` utiliza la topología cerrada de `generators.stairs()` y `polyBuffers()`, sin las caras interiores de cajas previamente fusionadas. `stairSteps()` continúa suministrando las dimensiones de cada peldaño a la exportación Godot. El cambio se limita a la escalera recta: **no se añadieron curvatura ni laterales configurables**.

## Evidencia automatizada reproducible

En la raíz del SOURCE_BASELINE:

```bash
node --test scripts/test-stairs-param-g001.mjs
node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)
npm run build
```

**En el entorno del asistente (27-10-2026):**

- Test específico STAIR-01..20: **20 PASS, 0 FAIL**.
- Regresión Node: **1499 PASS, 0 FAIL, 18 SKIP** (1517 contabilizadas, incluye las 20 anteriores).
- Verificación de sintaxis JS de módulos modificados: **PASS**.
- `npm run build`: **NO COMPILADO**. Código de salida 127, `sh: 1: vite: not found`. Dependencias de Vite no instaladas en este entorno.
- Test `test-starcat.mjs` excluido del comando acumulado por dependencia no instalada, igual que en el Gate de integración anterior.

**Límite de evidencia:** tests de topología y revisión contractual no prueban GPU, UI real, Jolt WASM, CSG en ejecución, Player ni exportación Godot ejecutada. Estas comprobaciones permanecen **NO VERIFICADAS**.

## QA local — usuario

1. Instalar dependencias del SOURCE_BASELINE en una copia aislada: `npm ci`, `npm run build`, `npm run electron`.
2. Insertar **Escalera**; verificar ocho peldaños y dimensiones iniciales `[3,3,6]`.
3. Cambiar Escalones a `2`, `40` y `64`: comprobar cantidad y silueta sin superficies internas visibles; `1` debe limitarse a 2 y `65` a 64 desde Inspector.
4. Modificar **X, Y y Z** con el inspector de transformaciones; confirmar ancho, altura y profundidad sin cambios de orientación ni desplazamiento de origen.
5. Asignar Blockout y un material distinto; revisar caras superiores, laterales, sombras, UV/escala métrica y ausencia de artefactos.
6. Guardar, cerrar y reabrir; comprobar que cantidad y dimensiones se preservan. Abrir un proyecto antiguo con Escalera sin `props.steps`: debe mostrar ocho peldaños.
7. Convertir una copia a Edit Mesh: comprobar vértices, aristas y caras editables, normales y dimensiones idénticas a la primitiva.
8. Probar un Brush sustractivo sobre la Escalera y la Escalera como brush; revisar cortes, ausencia de restos y restauración tras Undo/Redo.
9. Entrar en Player: comprobar visualización y colisión estática con Jolt, especialmente sobre peldaños inferiores y superiores; no validar usando solo capturas del Editor.
10. Exportar a Godot una escena con 64 escalones y colisiones; verificar la cantidad de instancias `Step_` y `Col_` y probar la escena exportada. La exportación usa cajas por peldaño (histórico), mientras el Editor/Player usan la envolvente cerrada: deben conservar la **misma silueta física exterior**.
11. Confirmar que las escaleras usadas como gráfico de eventos siguen utilizando el mismo rango y forma.
12. Probar al menos una escena antigua con rampa/cubo y Escalera para detectar regresiones ajenas al Gate.

**Evidencia solicitada:** salida del build, número de escalones en Inspector y viewport, capturas de Edit Mesh, captura/vídeo de Player al subir/bajar escalones, resultado de colisiones y exportación. El usuario decide la aceptación visual. No cerrar este Gate sin su aprobación posterior.

## Contrato y restricciones

- Reutilizados `stairSteps`, `stairsGeometry`, `generators.stairs`, `polyBuffers`, `fromPrimitive`, la firma de rebuild y el sistema `scale` existente.
- No se cambiaron formatos de serialización, proyectos, materiales, nodos de escena, lógica Jolt ni exportador.
- Riesgo pendiente: los triángulos de la envolvente nueva y los `BoxShape3D` por peldaño exportados no son representaciones internas idénticas. Su equivalencia exterior se ha comprobado matemáticamente y la ejecución real permanece pendiente de QA local.
- Los casos de curvatura y laterales configurables **no pertenecen a LF-STAIRS-PARAM-G001**; requieren planificación y autorización separadas.

**Estado a entrega:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · COMPILACIÓN/QA LOCAL NO VERIFICADOS · APROBACIÓN USUARIO PENDIENTE.
