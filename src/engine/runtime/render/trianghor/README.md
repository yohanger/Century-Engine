# TriangHor — puente de compatibilidad de Century

La autoridad de simplificación, índices, consultas espaciales y Worker reside en el paquete independiente `trianghor@0.0.1` instalado desde `vendor/trianghor`. Los archivos de esta carpeta son adaptadores o reexportaciones de API pública; `terrain-shader-cost.js` es un diagnóstico propio de Century.

El contrato vinculante es `docs/architecture/CE-TH-CA-001-INDEPENDENT-TRIANGHOR-CONSUMER-AUTHORITY.md`. El horneado del Editor, los clústeres y el LOD siguen siendo consumidores de Century y no duplican el algoritmo. No se cambia la serialización ni los datos de autoría de Terrain.
