# LF-EVENT-MATCH-G001 — Comando Match / Case / Default

**Fecha:** 2026-10-24  
**Estado:** IMPLEMENTADO · PENDIENTE QA GRÁFICA Y BUILD LOCAL

## Objetivo

Agregar un comando de flujo de eventos `Match (casos)` utilizando **el intérprete, el editor de comandos y el sistema de ramas que ya existen**. No incorpora Event Runner nuevo ni otro administrador de variables.

## Contrato de datos

`code: 'match'` utiliza:

- `p.src`: `variable`, `number`, `text`, `bool`, `signal` o `script`.
- `p.variable`, `p.value`, `p.text`, `p.flag`, `p.signalField` o `p.expr`: el valor que se evalúa **una sola vez** según `p.src`.
- `p.cases`: arreglo ordenado de casos con identificador estable `id`, tipo `src` (`number`, `text`, `bool`, `variable`) y datos tipados `value`, `text`, `flag`, `variable`.
- `p.hasDefault`: permite mostrar/ejecutar la rama `Default (_)`.
- `b['case:' + id]`: lista de comandos de ese caso.
- `b.default`: comandos de Default. Se conservan aunque se desactive temporalmente, para recuperarlos si se reactiva.

**Igualdad estricta:** `1` (número) no equivale a `"1"` (texto), ni a `true` (booleano). Las listas y objetos no son tipos de caso admitidos por este Gate. Entre casos iguales gana la **primera coincidencia** según el orden visible; nunca hay ejecución en cascada (fallthrough).

**Persistencia:** el modelo usa objetos y listas JSON ordinarios de los eventos actuales; `walk`, `clone` y la serialización existente recorren sus subcomandos. Los IDs de caso, y no los índices, determinan las claves `b`, por lo que reordenar mantiene cada bloque asociado a su caso. Eliminar deliberadamente un caso elimina su rama al aceptar la edición. Si se cancela el cuadro de parámetros, el borrador de parámetros se descarta.

**Ejecución:** `EXEC.match` recupera el valor del `Game` existente (`getVar`, `signalValue`, `evalExpr`) y ejecuta como mucho un `runList`. Se respetan sus señales de control `BREAK` y `EXIT` y la cancelación del `ctx`. El código se comparte entre editor y Player.

## Pruebas Node ejecutadas

```bash
node --test scripts/test-db-contract.mjs
```

**396 PASS / 0 FAIL / 0 TODO**; 371 de regresión + 25 nuevas pruebas Match (`MATCH-01..25`). Se validaron con el **Game real** y host simulado: orden, tipos, Default, anidamiento, señales, variables, script, Break/Exit, IDs, copia/guardado JSON y contratos de UI. `node --check` de los módulos JavaScript: PASS.

**Compilación:** `npm run build` no se pudo completar en este entorno: `vite: not found` (no hay `node_modules`). No se afirma QA visual ni compilación Vite del editor o Player.

## QA local — escenarios de aceptación

| ID | Prueba | Esperado |
|---|---|---|
| MATCH-LOCAL-01 | Nuevo evento → Insertar comando → Básico → Flujo | Aparece `Match (casos)` |
| MATCH-LOCAL-02 | Seleccionar variable y agregar Case numérico `0`, `1`, `2` | Las tres ramas aparecen en la lista |
| MATCH-LOCAL-03 | Añadir un comando «Mostrar texto» a cada Case | Se guarda en su rama, no en otra |
| MATCH-LOCAL-04 | Variable `1` = número `2` | Solo se ejecuta Case 2 |
| MATCH-LOCAL-05 | Case texto `"2"` y variable número `2` | No coinciden |
| MATCH-LOCAL-06 | Case booleano `true` y fuente texto `"true"` | No coinciden |
| MATCH-LOCAL-07 | Dos Cases coincidentes | Se ejecuta solamente el primero |
| MATCH-LOCAL-08 | Ninguno coincide | Se ejecuta Default si está activo |
| MATCH-LOCAL-09 | Desactivar Default y luego reactivarlo | No ejecuta estando oculto; conserva comandos al reactivarlo |
| MATCH-LOCAL-10 | Reordenar Cases con comandos distintos | Cada rama conserva sus comandos originales |
| MATCH-LOCAL-11 | Eliminar un Case | Los Cases restantes permanecen intactos |
| MATCH-LOCAL-12 | Crear Match dentro de Match y dentro de Si | Anidamiento correcto |
| MATCH-LOCAL-13 | Match en Bucle → Romper bucle | Detiene bucle y prosigue fuera |
| MATCH-LOCAL-14 | Match → Salir del evento | No ejecuta comandos posteriores |
| MATCH-LOCAL-15 | Fuente «Dato de señal» con campo `id` | Evalúa dato recibido sin variable global |
| MATCH-LOCAL-16 | Fuente «Expresión JS» | Evalúa la expresión usando runner existente |
| MATCH-LOCAL-17 | Guardar/cerrar/reabrir evento | Orden, Cases, Default y comandos persisten |
| MATCH-LOCAL-18 | Copiar/duplicar/comandos comunes | Estructura Match y ramas se conserva |
| MATCH-LOCAL-19 | Ejecutar Player exportado | Mismo comportamiento que vista previa |
| MATCH-LOCAL-20 | Evento anterior con Si/Opciones/Bucle | No presenta regresiones |

## Fuera de alcance

No modificar `Match` en JavaScript, no añadir patrones estructurales de objetos/listas de Python ni guardias de patrón. La comparación de casos es simple y tipada. No modifica F12, Three.js, fuentes, proyectos o Gameplay Object.

## Compilación requerida por QA del usuario

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-db-contract.mjs
npm run build
npm run electron
```

Verificar **editor y Player**; la aprobación final depende de las pruebas locales del usuario.
