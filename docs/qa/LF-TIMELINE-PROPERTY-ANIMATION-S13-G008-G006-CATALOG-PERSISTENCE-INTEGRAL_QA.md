# QA — S13-G008-G006 Catálogo y persistencia

**Estado:** pruebas específicas Node PASS; compilación Editor/Player, QA local Electron y export real NO VERIFICADOS. Usuario debe probar y aprobar.

## Evidencia ejecutada en este entorno

- `node --test scripts/test-timeline-property-animation-s13-g008-g006.mjs` → **26 PASS, 0 FAIL, 0 SKIP**.
- `node --test scripts/test-timeline-property-animation-s13-g008-g006.mjs scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs` → **50 PASS, 0 FAIL, 0 SKIP**.
- Regresión ampliada con 10 scripts: **154 tests reportados; 141 PASS, 8 FAIL, 5 SKIP**. Las ocho fallas de esa selección son **preexistentes en G005 o dependencias ausentes**, no certificadas como regresión de G006: paquete `jszip` ausente (1); scripts históricos de interpolación con import relativo dentro de `data:` (6, de los cuales 5 son subtests individuales más un archivo de prueba); recursos históricos (1). La comparación se repitió en SOURCE_BASELINE de entrada, confirmando esos fallos ya presentes. No se alteraron pruebas ajenas para ocultarlos.
- `npm run build` → NO VERIFICADO: falta Vite en el contenedor. Electron y AppImage NO EJECUTADOS aquí.

## Casos QA-01..QA-13

| ID | Condición | Criterio de aceptación |
|---|---|---|
| QA-01 | Catálogo `PROPS` compartido | Sin catálogo paralelo ni mezcla de authoring Clip/Timeline |
| QA-02 | Identidad por escena/nodo/prop | Crear una sola pista y reusarla |
| QA-03 | ID de escena diferente | No fusionar canales con escenas distintas |
| QA-04 | ID por nombre heredado | Reutilizar solo si el nombre es inequívoco |
| QA-05 | `vec3` | Rechazar dimensiones/tipos/NaN, no mutar array de entrada |
| QA-06 | `number` | Rechazar NaN/Infinity/coerción y límites conocidos |
| QA-07 | `bool` | Aceptar exclusivamente booleanos en datos tipados |
| QA-08 | `color` | Validación hexadecimal y canonización |
| QA-09 | Guardar/cargar/duplicar | Misma identidad y valores tras serialización y copia, sin renumerar claves originales |
| QA-10 | Recurso vigente sin `sceneId` | Mantener identidad y resultado anterior |
| QA-11 | Canal sin evaluador | Sin lectura `.map` ni reproducción prematura |
| QA-12 | Editor | Arrastrar nodo, agregar pista ya existente y reabrir recurso sin duplicados |
| QA-13 | Player | Build y export independiente sin conflictos de modelo o formato |

## QA local recomendado

Desde la raíz del proyecto que contiene `package.json`:

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g006.mjs
node --test scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs
npm run build
npm run electron
```

En Electron: (1) abrir un proyecto existente, (2) abrir Timeline y arrastrar un nodo desde Jerarquía, (3) repetir la misma propiedad sin crear otra pista, (4) verificar que pista/clave actuales conservan valores, (5) guardar y volver a abrir proyecto, (6) duplicar Timeline y comprobar UIDs nuevos, (7) verificar que no aparecen opciones numéricas/color nuevas antes de G007. Si dispone de recurso con `light.energy` o `light.color` tipado de prueba, comprobar persistencia sin animación; no modificar `.ui` ni escenas productivas para forzarla.

Entregar: salida Node, final completo de `npm run build`, y descripción de QA visual y persistencia, incluyendo errores y proyectos afectados. **Sin esta evidencia no declarar QA LOCAL PASS ni cierre.**
