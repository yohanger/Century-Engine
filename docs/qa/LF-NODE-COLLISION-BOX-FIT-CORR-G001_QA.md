# LF-NODE-COLLISION-BOX-FIT-CORR-G001 — QA

**Estado:** integración implementada; QA gráfico en Electron, Play/Player y Jolt WASM real pendiente.

| Prueba | Resultado |
|---|---|
| Núcleo de geometría: 9 casos | PASS |
| Validación recurso, Inspector, Jolt y SceneGraph: 8 casos | PASS (contrato de código) |
| Adaptador de escena simulado: 7 casos | PASS |
| Regresión TriMesh/Node Physics: 92 casos | 91 PASS, 1 SKIP (Three.js no instalado) |
| Validación sintáctica JavaScript modificados | PASS |
| Editor + Player con Vite | PENDIENTE (sin node_modules) |
| Colisiones Jolt WASM físicas, Play y Player exportado | PENDIENTE |
| Inspector en Electron, Undo/Redo y `.lfproj` real | PENDIENTE |

## Escenarios obligatorios de QA del usuario

1. `StaticBody3D` con primitiva `Piso` tamaño 20 × 0,5 × 20 y `CollisionShape3D` nueva: el recurso debe mostrar ese tamaño, no 1³, y centrarlo correctamente.
2. Mover la primitiva visual con respecto al cuerpo; comprobar posición de BoxShape3D, gizmo y colisión. Girar el cuerpo completo y la forma.
3. Modificar el tamaño de la primitiva mediante escala visual o entrar en Edit Mesh, mover vértices y confirmar; comprobar actualización del autoajuste.
4. Desactivar autoajuste; editar tamaño/posición, guardar/reabrir y confirmar que se conservan, sin reactivación silenciosa.
5. Con autoajuste desactivado, usar «Ajustar a geometría» una vez; luego cambiar otra vez la geometría y confirmar que sigue en manual.
6. Varias primitivas bajo un cuerpo, incluyendo `Node3D` intermedio y otro `StaticBody3D` anidado: calcular solo las fuentes propias y conservar otras `CollisionShape3D` manuales.
7. Undo/Redo de geometría y tamaño; Play y Player: Jolt debe usar el tamaño y el offset persistidos.
8. En cuerpos sin geometría válida, el botón debe dar un error claro sin alterar valores existentes.

## Ejecución

```bash
npm ci
npm run test:box-fit
npm run test:trimesh
npm run build
npm run electron
```

El Gate se mantiene pendiente de aceptación de QA en la instalación del usuario.
