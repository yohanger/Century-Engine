# S01-G001 TypeScript — QA y evidencia

**Gate:** `CENTURY-FLUIDS-S01-G001-INTEGRAL-TYPESCRIPT-CORE-AND-API`.
**Autoridad:** CF-CA-002 ratificado y Gate TypeScript autorizado el 19-11-2026.
**Estado:** IMPLEMENTADO, COMPILADO, TEST PASS en entorno de autoría; **APROBACIÓN/CIERRE DE USUARIO PENDIENTES**.

## Implementación

- TypeScript 5.8.3, `strict`, ESM NodeNext, export de declaraciones, sin dependencias en runtime.
- `Vec3` validado e inmutable; `FluidConfig` validada e inmutable; `FluidWorld` con lifecycle encapsulado, reemplazo atómico de configuración y `prepareStep` sin física.
- `FluidError` con código estable, campo de origen y excepción controlada.
- `package.json`, lockfile, TypeScript, API pública ESM, pruebas Node `node:test` y verificador S01.
- **No hay solver de fluidos, física simulada, Jolt ni Century**, conforme al alcance S01.

## QA realmente ejecutado

**Entorno de autoría:** Node.js `v22.16.0`, npm `10.9.2`, `tsc` global versión `5.8.3`.

- `npm run typecheck`: PASS.
- `npm run build`: PASS, salida ESM y declaraciones.
- `node --test tests/*.test.mjs` sobre `dist/index.js`: **10/10 PASS**.
- `npm pack --dry-run --json`: PASS; vista de paquete ESM con declaraciones y **sin `.rs` ni `src/` fuente activo**.
- `npm install --package-lock-only --offline`: PASS con los hashes oficiales ya consignados en el lockfile.
- `npm ci` (instalación limpia desde registro): **NO VERIFICADO**, entorno de autoría sin resolución DNS del registro npm.
- `python3 qa/verify_s01.py --project . --static-only`: PASS (estructura, manifiesto, ledger y alcance).
- `python3 qa/verify_s01.py --project .`: PASS (incluye `npm run qa` real).
- La comparación final de `CHANGE` y `SOURCE_BASELINE` contra el baseline Rust es ejecutada nuevamente tras empaquetar; verificación precisa en el resultado final de entrega.

Logs detallados: `qa/S01_TYPESCRIPT_RUN.log`.

## Resguardos y límites

- Core Rust histórico **SUPERSEDIDO**, pero fuente original íntegra en el `CENTURY_FLUIDS_S01_G001_INTEGRAL_RUST_CORE_AND_API_SOURCE_BASELINE.zip` anterior.
- El paquete incremental incluye `CHANGE_REMOVALS.json` con SHA-256 de ocho rutas activas retiradas. Ninguna eliminación es automática; si el archivo local difiere, **conservarlo y reconciliarlo**.
- S00 no se aprueba retroactivamente por autorización S01. S08 EN PAUSA; 11 Sprints y 11 Gates sin cambios en cardinalidad.
- La validación TypeScript **no acredita** DFSPH, colisiones, flotabilidad, rendimiento, Jolt WASM, Editor ni Runtime.

## QA local / aprobación

En una copia limpia de `CENTURY_FLUIDS`, con Node >=20 y acceso a npm:

```sh
npm ci
npm run qa
python3 qa/verify_s01.py --project .
```

Se solicitan logs de compilación, pruebas y uso real del toolchain instalado localmente. El Gate permanece **NO APROBADO / NO CERRADO** hasta QA local y decisión del usuario.
