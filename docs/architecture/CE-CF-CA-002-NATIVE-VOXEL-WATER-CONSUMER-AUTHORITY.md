# CE-CF-CA-002 — Native Voxel Water Consumer Authority

**Estado:** ratificado por el usuario; integración autorizada por `CENTURY-ENGINE-FLUIDS-S01-G001-NATIVE-CENTURY-FLUIDS-INTEGRATION`. Aprobación final pendiente.

## Fuentes y autoridad

- Century Engine: `Source(2).zip` (0.26.13). No se incorporan cambios de Smart Build.
- Century Fluids: `Century-Fluids-main(1).zip` (`@century/fluids` 1.0.0).
- La simulación de agua y la extracción de superficies pertenecen a la biblioteca independiente, integrada en `vendor/century-fluids/`.
- Century conserva las responsabilidades de nodos, persistencia, adaptador de escenas, Three.js y ciclo físico Jolt.
- Se conserva `LF-WATER-LEGACY-RETIREMENT-CA-006` en lo referido a retirada de `WaterWorld`, datos históricos y ausencia de migraciones. La nueva integración supersede únicamente la prohibición anterior de introducir el sustituto autorizado.
- La pausa de integración de Century Fluids se levanta solo para el consumo aquí autorizado; ello no cierra S08 ni S10 de la biblioteca independiente.

## Integración

El consumidor `src/engine/runtime/fluids/century-water.js` utiliza `@century/fluids`, `/water`, `/surface` y `/adapters/jolt` mediante sus APIs públicas. La escena entrega transformaciones, superficies de terreno y determinadas formas físicas; Jolt mantiene un solo paso físico. El estado voxel determina la superficie de Three.js. No se restaura el solver retirado.

El registro de nodos y la persistencia se rigen por la enmienda `CE-CF-CA-002-AM-001-EXISTING-WATER-NODE-AUTHORITY.md`.

## Límites

La librería externa no se reescribe para introducir adaptadores privados. Ninguna funcionalidad de la integración se considera visual o físicamente aprobada sin QA en el editor y Player exportado. No hay migraciones obligatorias ni cambios Git autorizados.
