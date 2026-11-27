# LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001

**Estado:** Contract Amendment de `LF-WEATHER-UNIFICATION-S02-G001`, autorizado para implementación el 31-10-2026. **QA visual y cierre pendientes.**

## Autoridad y precedencia

Vincula `LF-VFX-WEATHER-DECOUPLING-CA-001`, `LF-WEATHER-TORNADO-LIFECYCLE-CA-001`, S12/S12A, `LF-WEATHER-UNIFICATION-S01-G001`, contratos de CloudField, Shader/Sky y Player. La decisión expresa posterior del usuario exige que las nubes del cielo formen el tornado y que no se utilice un emisor VFX para el embudo. Las referencias anteriores a visualización meteorológica VFX quedan **SUPERSEDIDAS solo para el tornado visual**. No se altera el contrato de agua suspendida, brasas ni VFX3D genéricos.

## Cláusulas vinculantes

1. **World** conserva la autoridad exclusiva para posición, fase, intensidad, duración, viento y eventos del tornado. El modelo visual `tornadoVisualState()` deriva su alcance de esos datos, sin guardar estados visuales adicionales en escenas o Assets.
2. **CloudField/Sky** son responsables de la condensación visual. El mismo `SKY_FRAG` que dibuja nubes hace visible el embudo mediante densidad volumétrica localizada, usando textura de forma 3D, tintes e iluminación de la nube madre. El shader no crea un renderer, escena ni `VFX3D` independiente para el tornado.
3. La nube atmosférica se mantiene cuando no se forma tornado; el embudo progresa según las fases vigentes. La extensión visual hacia el suelo **no** altera `tornado.height` ni aumenta por sí sola el volumen físico del vórtice.
4. Queda **SUPERSEDIDA** la cláusula 4 de `LF-VFX-WEATHER-DECOUPLING-CA-001` para el tornado visual: no se crea el VFX3D transitorio y no se admite sustituir el embudo meteorológico mediante `tornadoVfxNodeId`. Igualmente quedan sustituidas las cláusulas S12/S12A y correcciones visuales posteriores que obligaban a tal emisor; se preservan sus obligaciones de viento, fuerzas, script, agua y fuego.
5. El Inspector elimina **Emisor VFX3D del tornado**. La migración explícita `migrateLegacyTornadoVisual()` descarta solamente la propiedad meteorológica `tornadoVfxNodeId` al normalizar. No muta la entrada ni elimina nodos VFX3D, recursos `.vfx`, referencias de usuario o proyectos anteriores. El campo retirado no vuelve a serializarse después de normalización y guardado.
6. Al detener Play, restaurar una fase `ended` o desactivar Weather, desaparece la condensación localizada del shader. No existen partículas meteorológicas transitorias que liberar; los nodos VFX genéricos siguen su ciclo de vida propio.
7. **Jolt, WindField, lluvia, agua, vegetación y fuego** conservan sus dueños actuales. El acoplamiento físico completo se revisará en S03, sin doble aplicación de fuerza en S02.
8. Rendimiento: el shader mantiene el raymarch de nube existente y añade hasta 12 pasos **solo** para los píxeles que intersectan el cilindro acotado del embudo; no dispara una marcha volumétrica sobre toda la pantalla cuando el tornado está ausente.

## Limitaciones y QA obligatorio

El shader del cielo es un fondo de escena: sin un buffer de profundidad de escena en esa ruta, la correcta oclusión volumétrica frente a geometrías 3D a diferentes distancias **NO está demostrada**. Esta entrega no se declara fotorrealista ni completa hasta comprobar la composición visual, la transparencia, tormentas sin tornado, la limpieza de Play/Stop y los FPS en Compatibility. Si la oclusión falla, debe abrirse corrección justificada antes del cierre; no agregar otro renderer por especulación.

El rectángulo negro observado con `Permitir tornados` desactivado corresponde al Gate independiente `LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001` y sigue **SIN CAUSA RAÍZ DEMOSTRADA**. Jolt WASM real permanece pendiente y mantiene S13 bloqueado.
