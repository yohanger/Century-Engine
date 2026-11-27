# S00-G001 change manifest

## Baseline

Primera baseline independiente de Century Radiance Generation II. No existe una baseline anterior de esta generación contra la cual calcular un delta. Por ello, el paquete CHANGE contiene el mismo conjunto inicial de archivos que SOURCE_BASELINE y declara explícitamente esta condición.

## Contenido autorizado

- Fundación TypeScript y API pública versionada
- Backend WebGL 2 con recursos propios sobre contexto prestado
- Worker tipado con progreso, cancelación, transferencia y limpieza
- Playground Three.js PBR de validación
- Pruebas Node y navegador
- Contratos CR-PA-001 y CR-CA-017
- Architecture Bible, roadmap, Gate y mapeo UE 4.1
- Manifiesto de archivos con SHA-256

## Exclusiones

No contiene Century Engine, Generation I, Unreal Engine, `node_modules`, cachés de navegador ni datos del perfil local. No integra, reemplaza, retira ni renombra sistemas del motor.

## Estado

Implementación y QA local completos. Aprobación y cierre pendientes. S01 no autorizado.
