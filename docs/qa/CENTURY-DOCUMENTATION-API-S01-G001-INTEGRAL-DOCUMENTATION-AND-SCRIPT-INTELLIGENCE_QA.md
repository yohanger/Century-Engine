# QA y cobertura — documentación y API

**Estado: PARCIAL.** No aprobado, no cerrado. Baseline de 4159 archivos verificado CRC y comparado con la copia anterior: igualdad de archivos. El árbol local del usuario no es accesible. No se modificó el runtime ni recursos de proyectos.

## Inventario y cobertura

Los JSON de evidencia identifican 64 interfaces, 6 alias y 749 declaraciones de miembros (incluyendo sobrecargas); 332 carecen de comentario JSDoc adjunto. No se inventaron comentarios para alcanzar una métrica. El inventario estático compara los 69 nombres del literal Game, 25 nombres del literal base NodeHandle y prefabs, scenes, timeline y nav. Los miembros añadidos dinámicamente, los objetos de host y sus retornos requieren auditoría adicional en Play. El inventario de 37 tipos registrados y la referencia no constituyen QA funcional de todos ellos.

| Hallazgo | Tratamiento | Estado |
|---|---|---|
| Game.dontDestroyOnLoad | Declaración de firma y efecto durante Play | Tipado comprobado |
| NodeHandle.dontDestroyOnLoad, keepOnLoad | Declaraciones y documentación | Tipado comprobado |
| Señales meteorológicas | Sobrecargas lightningImpact, tornado, treeUprooted y tornadoIgnition, con datos derivados de emisiones | Fuente y tipado; Play pendiente |
| game.water | Declaración histórica conserva @deprecated; el literal de _buildApi no la expone | Discrepancia contractual pendiente |
| Propietario de script | Code comparte metadatos y criterio de VS Code; CharacterBody3D exclusivo; desconocido/mixto conserva tipo general | Análisis Node/TS PASS; Electron pendiente |
| Directivas de Inspector | Proyección de editorSource en plugin TS; analizador compartido y diagnóstico en Code | TS real PASS; integración VSIX pendiente |
| Prefabs | Nombres de recursos en metadatos e IntelliSense | Node PASS |
| Referencia y manuales | 214 páginas generadas, 62 interfaces públicas en portal, 73 comandos y 37 nodos; seis manuales nuevos y actualización de marca | Pruebas de portal PASS; render exacto pendiente |

Los generadores de referencia reutilizan la declaración y catálogo de comandos. El portal candidato se generó con Marked 4.0.19 disponible (adaptador temporal fuera del ZIP), no con 12.0.2 fijado en package.json. Regenerar con la dependencia exacta antes de aceptar. No se garantiza una referencia exhaustiva de cada sistema ni la equivalencia de todos los diagnósticos de CodeMirror y TypeScript; estos servicios son diferentes. Las declaraciones dinámicas, contextos globales/UI/eventos y todos los ejemplos requieren mayor revisión. El contrato de agua CE-CF-CA-002-AM-002 restaura el sistema original como Deprecated y mantiene Century Fluids en pausa. La discrepancia de exposición de game.water no autoriza reactivación ni retirada: requiere resolución contractual.

## Resultados ejecutados

- Suite `documentation-api`: 26/26 (cinco pruebas focales y 21 de portal/Git docs).
- TypeScript real 5.8.3: completado, hover, firmas, diagnósticos y proyección de directivas en host del plugin; `tsc --noEmit --strict --lib es2022 src/core/events/game-api.d.ts` PASS (sin salida).
- Regresión de siete archivos: antes 89/90; después 88/90. La prueba de Workspace no arranca en ambos casos por Vite ausente. El fallo nuevo es manifiesto VSIX 0.1.12 frente a fuentes 0.1.13; no se ha debilitado la prueba ni alterado el manifiesto para ocultarlo.
- `docs:build` y `docs:check` PASS con adaptador temporal de Marked 4.0.19; reproducibilidad con Marked 12.0.2 NO VERIFICADA.
- `audit-api.py --static --strict` detecta `water` y devuelve 1; no se oculta la discrepancia. El auditor de Play no se ejecutó por ausencia de entorno Vite/runtime.
- `vscode:prepare` bloqueado por jszip y ausencia de vsce oficial; se conserva VSIX 0.1.12 previo y su manifiesto, no se distribuye un 0.1.13 falso.
- `documentation-api-electron` bloqueado antes de iniciar por Vite ausente; fixture real incorporado, seis comprobaciones previstas. `npm run build` bloqueado por Vite. No se abrió VS Code ni Electron real. Registro npm inaccesible (EAI_AGAIN).

## Aceptación pendiente

Con las dependencias fijadas instaladas, ejecutar `npm run docs:build`, `npm run docs:check`, `npm run vscode:prepare`, `npm run test:suite -- documentation-api`, `npm run test:suite -- documentation-api-electron`, `npm run build`. Ejecutar también la regresión indicada en evidencia y auditoría de Play `python3 scripts/audit-api.py --strict` con Vite en el puerto 5199. Abrir el proyecto real en Code y VS Code y comprobar propietarios, directivas, firmas y contexto; comparar resultados de API con los contratos. No cerrar hasta resolver discrepancias, completar cobertura y acreditar QA local y aprobación.
