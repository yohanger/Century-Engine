# Diseño técnico — Low-cost water defaults and activity-driven simulation

**Autoridad:** `CE-CF-CA-002-NATIVE-VOXEL-WATER-CONSUMER-AUTHORITY` y `CE-CF-CA-002-AM-001-EXISTING-WATER-NODE-AUTHORITY`.  
**Gate:** `CENTURY-ENGINE-FLUIDS-S01-G001-CORR-002-LOW-COST-DEFAULT-WATER-AND-ACTIVITY-DRIVEN-SIMULATION`.  
**Estado:** autorizado; implementado en fuentes, pendiente de QA visual y aprobación final.

## Alcance

El nodo persistente `water` mantiene su identidad y utiliza Century Fluids como única autoridad de la simulación. `fluidcontainer3d` conserva sus datos heredados sin reactivación. No se añaden nodos, solvers, rutas editoriales ni migraciones obligatorias.

Los valores por defecto de **nuevos** nodos `water` son tamaño de celda **0,40 m**, capacidad **16.000 celdas** y límite de superficie **24.000 triángulos**, centralizados en `src/engine/runtime/fluids/water-policy.js`. La cantidad inicial y la opacidad permanecen en 0,7. Las propiedades explícitas de escenas antiguas no se reescriben: un valor guardado de 0,25 m sigue dando 0,25 m. Los límites son cotas, no asignaciones previas de memoria.

El adaptador `century-water.js` continúa usando un único mundo voxel y el paso fijo de Jolt. Conserva `sleepAtRest`, evita avanzar el solver cuando `world.needsStep` es falso y no existe acoplamiento activo, y revisa en cada paso si un cuerpo entra cerca de celdas con agua. Solo se registra en el bridge Jolt cuando está dentro del área de influencia conservadora: tamaño del cuerpo, rotación posible y desplazamiento durante el paso. Los cuerpos fuera del agua no fuerzan simulación, mientras que los cercanos conservan flotabilidad y colisiones. Una consulta espacial indeterminada no excluye el cuerpo.

La sincronización de obstáculos estáticos agrupa `CollisionShape3D` por padre una vez por paso, evitando el recorrido cuadrático anterior. Se mantiene la comprobación de transformaciones y cambios de configuración para detectar obstáculos movidos por scripts. La malla dinámica de Three.js sigue derivándose de `VoxelSurfaceCache`: solo se consulta cuando cambia la revisión o queda un lote pendiente, y reconstruye como máximo dos chunks por solicitud con presupuesto objetivo de 1,5 ms. Este presupuesto no representa un límite rígido del coste de un chunk individual.

## Límites y compatibilidad

- Una misma escena continúa usando un mundo voxel compartido; la resolución se resuelve mediante el mínimo de los nodos activos, por lo que un nodo antiguo configurado a 0,25 m puede elevar el coste total de una escena mixta. Separar mundos requeriría otro contrato físico.
- Los cuerpos dinámicos dentro o próximos al agua requieren acoplamiento Jolt cada paso; no se omiten impulsos de flotabilidad para conseguir mejores métricas.
- El máximo de caras físicas por paso permanece en 600.000 como techo de seguridad. Reducirlo sin demostrar tolerancias de estabilidad podría provocar `STEP_BUDGET_EXCEEDED`; el trabajo efectivo disminuye por la resolución y la exclusión espacial.
- Se conservan los perfiles manuales de calidad y las escenas anteriores, sin cambios en Century Fluids 1.0.0 ni en sus APIs.
- La validación de rendimiento debe realizarse también en Electron sobre hardware objetivo; el benchmark Node acredita la reducción de carga del solver en el escenario medido, no FPS global.

## Instalación reproducible

Se corrige el registro de la dependencia anidada `typescript@5.8.3` en `package-lock.json` a partir de la integridad declarada por la distribución fuente de Century Fluids. `npm ci --dry-run --ignore-scripts --offline` validó el cierre del lockfile sin instalar módulos; una instalación y compilación completas siguen pendientes donde exista acceso al registro de npm.
