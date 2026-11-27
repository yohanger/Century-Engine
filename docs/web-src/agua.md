# Agua y fluidos

**Obsoleto (Deprecated):** el sistema de agua original sigue disponible. La integración de Century Fluids no está activa. No necesitas migrar tus escenas existentes.

El catálogo Agua ofrece océano, lago/piscina, estanque circular y río. Sus variantes y propiedades se encuentran en el Inspector; no confundas el aspecto de superficie con una región finita de simulación. Los recipientes y las regiones históricas tienen sus propios límites. Comprueba la colisión y el comportamiento del agua en el juego exportado.

## Uso y límites

Selecciona una variante de Agua y configura sus propiedades en el Inspector. Para proyectos que ya utilizan regiones físicas de Terrain o recipientes, comprueba el comportamiento en Play y en el juego exportado: una superficie visual no implica simulación de volumen. La simulación histórica de regiones utiliza una cuadrícula de aguas someras y no reproduce cascadas libres ni cavidades.

**Scripting:** `game.water` no está disponible desde el objeto público del intérprete actual. Evita utilizarlo en scripts nuevos.
