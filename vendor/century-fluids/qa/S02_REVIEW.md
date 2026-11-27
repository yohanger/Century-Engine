# S02-G001 — Informe de implementación y QA

**Gate:** `CENTURY-FLUIDS-S02-G001-INTEGRAL-PARTICLES-AND-SPATIAL-QUERIES`. **Autorización literal recibida:** 2026-11-19. **Estado:** IMPLEMENTADO, TYPECHECK PASS, BUILD PASS, TEST PASS, benchmark de referencia PASS. **QA en equipo del usuario y aprobación/cierre de S02: PENDIENTES.**

## Diferencial sobre S01 TypeScript

- Nuevos `src/particles.ts` y `src/spatial.ts`: almacenamiento SoA `Float64Array`, crecimiento controlado, identificadores estables, alta/cambio/baja y consultas hash grid tridimensional.
- Extensión de `FluidWorld` y API pública S01 sin romper sus diez tests, dos nuevos códigos de error.
- Documentación `docs/11_TYPESCRIPT_PARTICLES_AND_SPATIAL_S02.md`, tests S02 y benchmark determinista.
- Nuevo runner `qa/verify_s02.py`: **no valida el nombre físico de la carpeta**. Se conserva el runner S01 histórico sin abrir Gate correctivo para él.
- Actualización del ledger con 11 Sprints/Gates, aprobación expresada por el usuario para S01, autorización S02, evidencia real y preservación S08 EN PAUSA.

## Evidencia ejecutada (entorno de autoría)

Fuente: `qa/S02_RUN.log`.

| Comando | Resultado |
| --- | --- |
| `node --version` / `npm --version` / `tsc --version` | Node 22.16.0, npm 10.9.2, TypeScript 5.8.3 |
| `npm run qa` | Typecheck + build + `node --test`: **21/21 PASS, 0 FAIL** (10 S01 + 11 S02) |
| `node tests/benchmark_particles.mjs` | **PASS de coincidencia con oráculo**: 12.000 partículas, 150 consultas, 445 vecinos en ambos enfoques |
| `npm pack --dry-run --json` | PASS; artefactos ESM y declaraciones incluidos; paquete no publicado |

**Medición de un solo proceso (referencia, no umbral):** inserción 13,335 ms, consulta hash 17,246 ms, fuerza bruta 77,898 ms; `heapUsed` 7.338.168 bytes, `rss` 39.510.016 bytes. No se infiere FPS ni escalabilidad universal. No se ha perfilado un solver porque todavía no existe.

## Cobertura de tests S02

- IDs estables, swap-removal, límites de capacidad y no reuso de IDs tras vaciado.
- Estado de partículas distinto en mundos independientes, snapshot `Float64Array` aislado, masas, estados y cierre.
- Modificación atómica y fallos controlados de entradas inválidas.
- Vecindad 3D, radio inclusivo, coordenadas negativas, invalidación tras cualquier cambio, radios distintos.
- Comparación contra fuerza bruta con pseudoaleatoriedad determinista, 900 partículas, radios variables, eliminaciones y actualizaciones.
- Dominio extremo rechaza indexación no representable en vez de devolver datos inválidos.

## Límites / pendientes que NO se declaran implementados

- **No solver de líquidos ni agua visible:** S03; **no colisiones físicas:** S04; **no Jolt:** S06; **no visualización:** S07/S09; **Century S08 continúa EN PAUSA**.
- Instalación remota limpia `npm ci`: NO VERIFICADA en entorno de autoría. `tsc` global versión 5.8.3 y lockfile existente fueron utilizados sin instalar otra dependencia.
- QA ejecutada en máquina del usuario: PENDIENTE. S01 fue aprobado por el usuario aunque su antiguo runner local rechazó un nombre de directorio; esto no se ha presentado como test local PASS.
- S00 numérico pendiente de ratificación; S02 no prueba densidad, presión, conservación física bajo simulación ni DFSPH.

## Reproducción local

Extraer el `SOURCE_BASELINE` completo; su carpeta raíz puede renombrarse `Century Fluids` sin romper S02:

```sh
cd 'Century Fluids'
npm ci
python3 qa/verify_s02.py --project .
```

Para comparar incrementales también pasar `--previous-baseline`, `--baseline` y `--change` con los tres ZIP precisos (la opción comprueba hashes, bajas seguras y contenido). No sobrescribir archivos locales modificados sin reconciliar.
