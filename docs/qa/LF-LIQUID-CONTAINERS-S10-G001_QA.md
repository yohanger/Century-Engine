# QA — LF-LIQUID-CONTAINERS-S10-G001

**Autorización:** `Listo. LF-LIQUID-CONTAINERS-S10-G001 autoriza comenzar`.
**Amendment:** `docs/architecture/LF-WATER-LIQUID-CA-003.md`.
**Estado:** IMPLEMENTADO · TEST NODE PASS · COMPILACIÓN/QA LOCAL PENDIENTE · NO CERRADO.

## Batería automatizada

`npm run test:liquid-containers` integra pruebas S10 con regresión S09/WATER S01–S08, audio, render y física de nodos. Las pruebas S10 verifican: capacidades, densidades, recipientes caja/cilindro, inclinación y umbral, caudal, transferencia A→B automática/manual, rechazo de mezclas, derrames compatibles, balance por especie, volatilidad del estado de Play, snapshots v6, rollback y rutas de persistencia.

Las 9 pruebas opcionales históricas que dependen de módulos no instalados deben conservar estado SKIP en el registro; jamás contarlas como PASS. Ejecución final y cifras exactas: ver salida del runner de este Gate.

## QA local obligatorio del usuario

1. `npm ci`, `npm run test:liquid-containers`, `npm run docs:build`, `npm run docs:check`, `npm run build`, `npm run electron`.
2. En Assets crea `Café.liquid`, configura densidad 1035 kg/m³, viscosidad relativa 2 y color marrón. Cierra y vuelve a abrir el recurso; verifica que los valores se conservan.
3. Crea un nodo `Node3D` con una taza o recipiente visual; en su Inspector activa **Recipiente abierto**, interior **Cilindro**, medidas y volumen inicial inferiores a la capacidad. Activa Play e inclínalo. Comprueba nivel, respuesta y vertido gráfico. Recuerda que la geometría decorativa no define automáticamente el interior.
4. Coloca un segundo recipiente bajo la salida del primero con el **mismo perfil**, dejando capacidad disponible; confirma transferencia. Repite con agua como destino y comprueba que no mezcla ni desaparece inventario.
5. Crea una región física de Terrain con el perfil adecuado y repite el vertido: comprueba acumulación y flujo en la región. Fuera de un dominio compatible la salida se registra, pero no hay charco físico visible.
6. Repite con `RigidBody3D`, movimiento y rotación; verifica que la pose visual coincide y que no existen partículas/recipientes residuales al detener Play o cambiar escena.
7. Guarda y abre `.lfproj`; exporta/importa `.levelpackage` de escena + perfil, comprueba IDs y dependencias, duplicación y bloqueo de eliminación de `.liquid` en uso por una escena guardada o prefab.
8. Prueba snapshot / restaurar partida, Undo/Redo de perfiles, proyectos WATER anteriores y exportación Player. Aporta FPS y memoria durante varias tazas simultáneas.

## Evidencia a devolver

Logs de Node/build/docs; capturas de recurso, Inspector, vista de agua; un video de inclinación, vertido y recepción; resultados de Player y medidas de rendimiento. No concluir QA LOCAL PASS ni CERRADO sin evidencia del usuario.

## Regresiones y límites

S09 aprobado por usuario; sus pruebas omitidas y QA físico local siguen sin evidencia. Los renderizados de superficie y chorro de S10 son aproximaciones; el caudal no valida geometrías arbitrarias ni mezclas químicas. Las referencias de `.liquid` han de sobrevivir en `.lfproj`/`.levelpackage` (verificación Node estructural, round-trip real pendiente de dependencias `jszip`).
