# LF-UX-INTERACT-G001_CORR-001 — QA / Contrato de interacción espacial

**Proyecto:** LevelForge 0.26.13  
**Fecha:** 2026-10-24  
**Autorización:** «Listo. LF-UX-INTERACT-G001_CORR-001 autoriza comenzar»  
**Estado:** IMPLEMENTADO · **PENDIENTE QA VISUAL LOCAL**

## Alcance

Se extiende el indicador espacial nativo, sin modificar Jolt, Database, View Model, EventBus ni Input Map. Gameplay Object conserva el indicador **ON** por defecto; Event conserva **OFF** por página y solo lo muestra en páginas `Botón de acción` habilitadas. Los Canvas personalizados de rol `prompt` conservan prioridad.

Cada instancia/página dispone de `indicatorZones`:

- `ring`: esfera (radio) o caja (tamaño XYZ), centro local y rotación local de caja.
- `key`: segunda zona independiente de esfera/caja; la tecla aparece solamente cuando además la acción realmente es elegible.
- `visual`: posición automática por límites del modelo o punto local del anillo, desplazamiento local de la letra, escala.

Las áreas de indicador **no son colliders físicos**. Se evalúan en coordenadas locales mediante el nodo 3D y la posición de cámara, separadas de proyección/oclusiones. El centro proyectado se limita al área visible de los límites cuando el objeto está parcialmente dentro del encuadre. La tolerancia de borde de 4 cm solo evita fluctuaciones pequeñas; no mantiene objetivos realmente alejados.

Los volúmenes se dibujan como auxiliares azul/verde en el editor y en el visor de páginas, nunca en el Player. La vista de escena del editor representa la primera página; el visor de páginas permite revisar la página seleccionada.

## Regresión automatizada realizada

Comando:

```bash
node --test scripts/test-db-contract.mjs
```

- **263 PASS / 0 FAIL / 0 TODO** (243 heredadas + 20 UX-CORR).
- Sintaxis JS: `node --check` de módulos de geometría e indicador, PASS.
- Cobertura nueva: radios independientes, esferas/cajas, rotaciones, offsets, tolerancia, compatibilidad, persistencia de páginas, proyección parcial, oclusión y Canvas personalizados.
- **No equivale a una prueba visual real en Three.js/Vue, Electron o Player exportado.** Parte de las pruebas utiliza un host gráfico simulado.

`npm run build` aquí produce `vite: not found` porque este Source Baseline no lleva `node_modules`. No se atribuye PASS a compilación ni a pruebas gráficas no ejecutadas.

## QA visual obligatoria en el equipo del usuario

| Caso | Procedimiento | Esperado | Estado |
|---|---|---|---|
| UX-C01 | Repetir `Screencast from 2026-10-24 15-24-04.webm`: cubo en esquina inferior izquierda, mover cámara sin salir de zona. | Anillo visible mientras el modelo esté dentro de encuadre/zona y no ocluido; no se pierde por filtro angular. | PENDIENTE |
| UX-C02 | Gameplay Object → activar indicador; esfera anillo 4 m, tecla 1.5 m. | A 3 m anillo solo, a 1 m anillo + tecla cuando pueda interactuar. | PENDIENTE |
| UX-C03 | Cambiar anillo a caja 4×2×1. | La detección respeta volumen de caja, no radio circular. | PENDIENTE |
| UX-C04 | Girar caja 90° Y. | Se intercambian eje longitudinal/lateral en el mundo. | PENDIENTE |
| UX-C05 | Desplazar centro anillo 2 m X. | La zona se desplaza respecto a la instancia. | PENDIENTE |
| UX-C06 | Cambiar tecla a esfera de 0.8 m. | La tecla solo aparece dentro de esa zona y cuando E activa realmente el objeto. | PENDIENTE |
| UX-C07 | Tecla en caja con rotación y offset. | Sin discrepancias entre gizmo, E y letra. | PENDIENTE |
| UX-C08 | Desactivar anclaje automático del anillo, offset local. | El anillo cambia de posición sin mover el objeto. | PENDIENTE |
| UX-C09 | Cambiar posición local de la letra. | La letra se desplaza respecto al anillo; sin mover detección ni objeto. | PENDIENTE |
| UX-C10 | Cambiar escala. | Cambia tamaño de anillo y letra en HUD. | PENDIENTE |
| UX-C11 | Pared entre cámara y objeto. | Indicador oculto por oclusión; no se ve a través de paredes. | PENDIENTE |
| UX-C12 | Objeto completamente fuera de cámara. | Indicador oculto; al reentrar no se demora artificialmente. | PENDIENTE |
| UX-C13 | Moverse suavemente cerca de límite. | Sin parpadeo por centésimas de metro. | PENDIENTE |
| UX-C14 | Event Page 1 OFF, Page 2 ON; alternar con self-switch. | Indicador sigue la página actual, OFF no impide E. | PENDIENTE |
| UX-C15 | Evento antiguo sin `indicatorZones`. | Sigue OFF, no se corrompe el proyecto. | PENDIENTE |
| UX-C16 | Canvas personalizado para `prompt`. | No aparecen dos avisos simultáneos. | PENDIENTE |
| UX-C17 | Objetos próximos con distintas zonas. | Una acción E, indicador alineado al candidato vigente. | PENDIENTE |
| UX-C18 | Guardar y reabrir proyecto/escena. | Se preservan formas, radios, dimensiones, offsets, giros y defaults. | PENDIENTE |
| UX-C19 | Ejecutar en modo Juego y Player exportado. | Misma presentación, sin ayudas 3D azules/verdes en el juego. | PENDIENTE |
| UX-C20 | Regresión Event/Gameplay Object/Jolt. | Recoger/soltar/lanzar no se altera por la presentación. | PENDIENTE |

## Evidencia necesaria para cierre del Gate

Registrar compilación local de editor/Player, video de UX-C01 y UX-C02/03/04, captura de Inspector/visor página con gizmos, casos de pantalla parcialmente visible, caso oclusión, persistencia y ejecución exportada. Solo después se podrá marcar el Gate como QA aprobado.

## Compatibilidad y límites

- `showIndicator` ausente: Gameplay Object ON; Event OFF por página.
- Los valores de distancia antiguos se emplean para inicializar las zonas faltantes; no se borran propiedades.
- En los eventos cuyo indicador está desactivado, no se altera la interacción con E.
- El volumen de tecla es independiente, pero una tecla no se representa sola sin anillo. Si el creador coloca una zona de tecla fuera de la del anillo, el objeto puede seguir siendo interactuable aunque no se muestre un aviso en esa región; documentar/probar esa configuración conscientemente.
- El `Source Baseline` conserva íntegramente el código y assets de origen. No incluye `node_modules`, compilaciones ni archivos temporales.
