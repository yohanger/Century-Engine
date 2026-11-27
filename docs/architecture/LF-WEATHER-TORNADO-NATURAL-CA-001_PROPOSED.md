# LF-WEATHER-TORNADO-NATURAL-CA-001 — RATIFICADO PARA S01

**Estado:** APROBADO por autorización exacta de `LF-WEATHER-TORNADO-NATURAL-S01-G001`. Redactado originalmente como propuesta durante S00. **Su implementación está limitada a S01; la integración volumétrica de S02–S03 requiere Gates propios.**

**Parent:** `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001` (prevalece mientras no se apruebe esta propuesta), `LF-WEATHER-TORNADO-LIFECYCLE-CA-001`, `LF-VFX-WEATHER-DECOUPLING-CA-001`, contratos de CloudField/Sky/World/Player.

## Enmiendas ratificadas, con aplicación por etapas

1. **Vínculo nube madre:** CloudField, cuando está activo, suministra una región/nube madre seleccionada de forma determinista y estable a partir de las celdas existentes. En modo clásico se define una región derivada dentro del campo procedural Sky, no otra nube ni nueva escena.
2. **Organización previa:** durante `development`/`organization` la tormenta madre puede desarrollar estructura visual sin crear fuerza física de tornado ni saltar a un embudo. La evolución responde al estado de World.
3. **Condensación integrada:** el shader atmosférico deberá integrar base y embudo en un solo modelo de densidad/transmitancia/iluminación; la composición independiente `tornadoCloudVolume()` se sustituirá solo después de demostrar que el nuevo dominio de raymarch cubre el segmento bajo la base y mantiene oclusión y costes aceptables.
4. **Realismo no determinista prohibido:** deformación y ruido espacial coherentes y reproducibles; para `cloudSeed=0` debe acordarse explícitamente el contrato de semilla efectiva al restaurar. Si requiere persistencia adicional, declarar la modificación de snapshot antes de implementarla.
5. **Visibilidad ≠ contacto físico:** condensación, polvo de suelo, interacción con agua y fuerza Jolt no pueden deducirse de un único campo de opacidad; el render no modifica masas ni aplica fuerzas.
6. **VFX3D:** permanece complemento de partículas genéricas; nunca se utilizará como sustituto de embudo o segunda nube. No se altera el modelo de recursos `.vfx` ni se añade emisor meteorológico obligatorio.
7. **Regresión y cierre:** mismos proyectos Editor/Player, clima sin tornado, nieve/lluvia, final de fase, Play/Stop, Compatibility y presupuestos GPU medidos. El éxito visual requiere QA del usuario, no solo shader compilado.

## Alcance de las cláusulas futuras y dependencias

El parent vigente ordena condensación atmosférica desde Sky con campo volumétrico localizado y permite `tornadoCloudVolume` actual. Este CA plantea sustituir **el mecanismo de composición independiente** sin violar el principio «nube y embudo desde el mismo sistema». El cambio afecta diseño del shader y contratos de compatibilidad/rendimiento. **Ratificado contractualmente por el Gate S01**, pero **no autorizado para implementar el cambio volumétrico de S02** sin la declaración y autorización de S02. La presente implementación mantiene `tornadoCloudVolume()` por compatibilidad transitoria.

## RATIFICACIÓN — 31 de octubre de 2026

**Estado contractual actual: APROBADO POR AUTORIZACIÓN DEL GATE `LF-WEATHER-TORNADO-NATURAL-S01-G001`.** Se conserva el nombre histórico `*_PROPOSED.md` para mantener trazabilidad del expediente S00; el encabezado y esta ratificación expresan el estado vigente. La autorización literal fue: `Listo. LF-WEATHER-TORNADO-NATURAL-S01-G001 autoriza comenzar`.

**Aplicación acotada S01:** cláusulas 1, 2, 4 (identidad y semilla efectiva), 6 y 7 en el ámbito de organización de nube madre. La condensación integrada de la cláusula 3 y la interacción de superficie de la cláusula 5 **no se implementan en S01**. La composición de `tornadoCloudVolume()` sigue vigente de manera transitoria hasta S02. Ninguna cláusula autoriza un segundo World, CloudField, VFX3D meteorológico o motor de física.

**Precisión sobre restauración:** se guarda la semilla efectiva y la deriva/evolución de CloudField, junto con la clave de mosaico elegida para la nube madre. Ello reconstruye la distribución atmosférica en el caso de guardado comprobado; no acredita todavía reproducción completa de transiciones meteorológicas en mitad de un fade ni la misma salida visual bajo todas las cámaras. QA local de Player pendiente.

**Transición prevista S02:** revisar dominio volumétrico bajo base de nubes y cambiar la composición diferenciada **solo** mediante un Gate S02 autorizado y con prueba de rendimiento/oclusiones. S01 no sustituye las rutas existentes de condensación del embudo.

## APLICACIÓN DE CLÁUSULA 3 — S02 (31 de octubre de 2026)

**Autorización exacta:** `Listo. LF-WEATHER-TORNADO-NATURAL-S02-G001 autoriza comenzar`. La cláusula 3 ya ratificada durante S01 se aplica en el Gate S02, **sin** extender autoridad sobre Jolt, World, Save/Load, `.vfx`, agua ni superficie. Se sustituye exclusivamente la composición posterior de `tornadoCloudVolume` por un integrador atmosférico común que recorre, en orden de profundidad, el intervalo de nube y el segmento de condensación inferior.

Este permiso **no certifica** que el volumen del cielo se componga correctamente frente a toda geometría sólida. El parent `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001` ya declara esa limitación expresamente. Debe comprobarse y, si falla, corregirse dentro del alcance de profundidad autorizado por S02 o bloquear el cierre hasta ratificar una enmienda si fuera necesaria.

El resultado visual, el rendimiento GPU, los perfiles de render y el Player son condiciones de QA del usuario; no constituyen hechos aprobados por la mera autorización del Gate.
