# LF-VFX-CA-001 — Cambio de alcance del ejemplo de vapor de café

Fecha: 2026-10-29  
Autoridad: decisión expresa del usuario tras aprobar LF-VFX-S03-G001.  
Estado: APROBADO (decisión de producto) · documentación de usuario PENDIENTE.

## Decisión vinculante

Se DESCARTA la implementación anteriormente planificada en `LF-VFX-S03-G002` de un recurso/preset, una taza, una escena de ejemplo o un placeholder dentro de LevelForge. El vapor de café será exclusivamente un ejemplo didáctico en la documentación para el usuario: instrucciones para crear el efecto usando el editor VFX real. La previsualización de `.vfx` debe seguir siendo independiente de cualquier objeto/taza y de los datos de escena.

Este Amendment **sustituye solamente** el alcance «preset + escena + rendimiento del café» de `LF-VFX-S00-G001_SPRINTS.md` y de sus registros de planificación. El esquema VFX, la simulación, los nodos y el editor aprobados no cambian. El tutorial no se declara redactado ni probado con esta decisión.

## Consecuencias

- `LF-VFX-S03-G002` como Gate de implementación de café: DESCARTADO; no se ejecuta.
- Futuro trabajo independiente: documentación de usuario con pasos, parámetros reales, captura y resultado comprobado por el usuario; autorización mediante su propio Gate antes de redactarlo.
- No incluir recursos de muestra instalados, placeholders, nuevas escenas ni dependencias de una taza.
- S03-G001 fue aprobado por el usuario, pero no se inventan resultados de compilación, WebGL ni QA gráfico.
