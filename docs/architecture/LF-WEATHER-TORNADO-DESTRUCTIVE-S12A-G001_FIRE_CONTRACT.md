# Contrato S12A — Combustión simplificada y brasas meteorológicas

**Autorización:** `LF-WEATHER-TORNADO-DESTRUCTIVE-S12A-G001`, conforme a la fórmula exacta del Gate.

## Modelo autorizado

- `TornadoCombustion` es un **modelo acotado de estado térmico**, no un sistema de partículas ni una simulación CFD. Usa una tabla de fuentes con ID, posición, combustible, humedad, umbral de ignición, temperatura y estado `burning`.
- La ignición requiere fuente combustible, combustible restante y temperatura superior al umbral ajustado por humedad. Un impacto físico de rayo podrá proporcionar energía térmica; la mera presencia de VFX de llamas no lo hará.
- Cada foco activo consume combustible. Las brasas son paquetes **lógicos** con posición, edad y calor; se desplazan por el `WindField` existente y pueden intentar prender fuentes compatibles por proximidad y temperatura. Máximos: 64 fuentes y 96 brasas.
- La precipitación, contacto con agua física o paquetes de agua suspendida depositados podrán incrementar humedad y reducir temperatura. La extinción no crea líquido ni elimina masa de `WaterWorld`.
- Fuentes y brasas se almacenan en el snapshot del Play (`tornadoDestruction.fire`) y restauran por identidad; se conservan al terminar el tornado mientras siga activo el Play. Play/Stop libera el estado de simulación sin cambiar la autoría de nodos y Terrain.
- Solo las fuentes compatibles, declaradas en Inspector (`props.combustion`) o en Terrain (tipo destructible/combustible) son registradas. No se habilita incendio indiscriminado de cualquier malla o edificio.
- La representación de brasas/fuego se realiza **exclusivamente** mediante el nodo VFX3D seleccionado y su recurso `.vfx`, con emisión condicionada al estado físico; sin recurso no hay emisor alternativo. El efecto visual no determina decisiones de ignición.

## Exclusiones vinculantes

No se implementa química, propagación volumétrica de llamas, deformación de materiales, daño universal de salud, propagación garantizada sobre cualquier objeto, ni destrucción estructural de edificios. Los árboles importados no se fragmentan si no tienen geometría separable verificada.

**Aceptación:** pruebas de umbrales seco/húmedo, llama espontánea desactivada, ignición por rayo, dispersión de brasas, enfriamiento por agua y lluvia, presupuestos, snapshots, VFX condicionado, Play/Stop y Player QA local.
