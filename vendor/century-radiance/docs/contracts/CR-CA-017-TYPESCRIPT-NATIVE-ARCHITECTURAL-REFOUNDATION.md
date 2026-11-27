# CR-CA-017 · TypeScript-Native Architectural Refoundation

**Estado:** RATIFICADO  
**Fecha de ratificación:** 27 de noviembre de 2026  
**Aplicación:** Century Radiance Generation II  
**Gate vigente:** CENTURY-RADIANCE-S00-G001-UNREAL-INSPIRED-LIGHTING-FOUNDATION

## Decisiones vinculantes

1. Century Radiance Generation II será una implementación nueva e independiente.
2. No sobrescribirá ni utilizará Century Radiance Generation I como dependencia activa.
3. TypeScript será la autoridad del procesamiento CPU.
4. GLSL será la autoridad de las operaciones GPU.
5. WebGL 2 será el backend gráfico inicial y obligatorio.
6. Three.js conservará la autoridad de rasterización y PBR base.
7. Unreal Engine 4.1 será la referencia técnica obligatoria para la arquitectura de iluminación.
8. No se copiará, traducirá ni incorporará código, shaders o activos propietarios de Unreal Engine.
9. Century Engine conservará World, escenas, nodos, jerarquías, identidad, transformaciones y serialización.
10. Century Engine conservará física, scripting, eventos, recursos y simulación.
11. Century Radiance será la autoridad de la política y el transporte de iluminación.
12. Century Radiance será responsable de iluminación directa, sombras, lightmaps, iluminación indirecta, Sky Light y Reflection Environment.
13. Century Radiance será responsable de la composición visual óptica definida por sus Gates.
14. World conservará reloj, clima, viento y estado atmosférico de simulación.
15. Century Radiance consumirá el estado atmosférico sin duplicar su simulación.
16. La integración futura utilizará una API pública, tipada y versionada.
17. Century Radiance no podrá importar Vue, Electron, stores ni herramientas exclusivas del Editor.
18. El contexto WebGL 2 pertenecerá al consumidor y los recursos creados por Radiance pertenecerán al módulo.
19. La API deberá definir ciclo de vida, errores, capacidades, diagnóstico, reset y dispose.
20. Los Workers deberán disponer de protocolo tipado, progreso, cancelación, limpieza y límites de trabajo.
21. Los buffers transferibles deberán utilizar transferencia real de propiedad cuando corresponda.
22. OffscreenCanvas solo se adoptará cuando exista soporte comprobado y un beneficio medido.
23. Hybrid será el modo de iluminación predeterminado.
24. El horneado será una operación editorial explícita.
25. Se reconocerán las movilidades Static, Stationary y Movable, evitando doble energía.
26. Mover cámaras, puertas u objetos móviles no iniciará automáticamente un nuevo horneado.
27. Los nodos, escenas, recursos y formatos existentes deberán preservarse durante la futura integración.
28. S00 se limitará a la fundación. No autoriza S01, integración con Century Engine, renombramientos físicos ni retirada de implementaciones anteriores.

## Ratificaciones de evidencia

- `source_baseline29` es el baseline operativo local autorizado para la auditoría de S00-G001. No se declara idéntico al histórico `source_baseline(10).zip`.
- El árbol extraído de Generation I y su manifiesto interno verificado de 581 archivos constituyen evidencia histórica suficiente para S00-G001. No se autoriza modificarlo ni usarlo como dependencia activa.
- `UnrealEngine-4.1.zip`, SHA-256 `e0edd4c287d9e9f52f1de85b72a49fa8bbb479e79fbcd0844210678b7e1631df`, es referencia técnica privada y de solo lectura.
- Century Runtime es la denominación oficial que sustituirá Century Player. S00 la incorpora únicamente a contratos, arquitectura, planificación y trazabilidad. Todo renombramiento físico requiere otro Gate.
- Las denominaciones históricas se conservan en contratos, evidencias, ledgers y registros anteriores.

## Efecto del contrato

Este contrato autoriza implementar la fundación independiente de S00. No autoriza integrar, sustituir, retirar, renombrar físicamente ni modificar los árboles auditados.
