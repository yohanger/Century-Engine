# QA documental — S17-ARCH-G001

**Estado:** DOCUMENTADO; QA DE CONTRATO POR USUARIO PENDIENTE; NO APROBADO; NO CERRADO.

## Cobertura de auditoría

- Verificar la existencia real de todos los archivos fuente citados en el inventario; no hay cambios en runtime.
- Comparar SHA-256 y rutas de todo código original entre ZIP precedente y SOURCE_BASELINE nuevo; **0 cambios de producción**.
- Verificar que el documento `OPT-PA-001` indica PROPUESTO / no ratificado en portada, responsabilidades y continuidad.
- Revisar los tres diagramas Mermaid en un visor compatible; diagramas fuente incluidos incluso si no se dispone de renderizador Mermaid local. Distinguir flechas reales de interfaces futuras.
- Confirmar en Excel seis hojas, filas nuevas append-only y ninguna fila histórica eliminada/sobrescrita.
- Verificar ZIP CHANGE contiene solo archivos nuevos/modificados y SOURCE_BASELINE contiene la totalidad de archivos precedentes.

## QA que corresponde al usuario

1. Validar nombres de roles y jerarquía: `OptimizationOrchestrator` coordinador, no otro Mesh, no otro renderer y no otro LOD duplicado.
2. Validar cómo se decide detalle por error proyectado, textura/mips, elegibilidad de Mesh, fallback, invalidación de derivados.
3. Validar que el flujo Editor/Build prepara lo costoso y Runtime solo decide lo económico.
4. Resolver pendientes O-01 a O-08, particularmente automatización vs opt-in de batching y cache persistente.
5. Ratificar contrato padre **solo si el contenido refleja la decisión del usuario**. La ratificación no autoriza código.

## Fuera de alcance del QA de este Gate

No construir AppImage, no recompilar renderer, no medir nuevas ganancias de FPS, no declarar streaming o culling prebake implementados. Los datos de AO y Escena heredados permanecen con sus estados de QA originales.
