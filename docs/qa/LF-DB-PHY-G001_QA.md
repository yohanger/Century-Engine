# LevelForge — LF-DB-PHY-G001 · QA de físicas en Database y eventos

**Gate:** IMPLEMENTADO — PENDIENTE QA LOCAL  
**Baseline:** `LevelForge_SIG_PHY_CONTRATO_SOURCE_BASELINE.zip`  
**Contrato:** `docs/qa/LF-DB-PHY-G001_CONTRATO.md`  
**Regla:** sin scripts obligatorios; extender física Jolt, páginas de eventos y View Model existentes.

## 1. Preparación e instalación

Desde `~/ENGINES/lf-0.26.13/lf`, instalar el Change ZIP:

```bash
unzip -o "$HOME/Downloads/LF-DB-PHY-G001_CHANGE.zip" -d "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-db-contract.mjs
npm run build
```

**Runner esperado:** 151 PASS, 0 FAIL, 0 TODO (137 existentes + 14 PHY). Se ejecutó en entorno aislado. Aquí `npm run build` no pudo completarse porque el baseline no contiene `node_modules` (`vite: not found`); **no** figura como PASS. Si el proyecto local ya tiene dependencias, ejecutar normalmente; si no, instalar según el README existente y el lockfile, sin cambiar dependencias.

## 2. Configuración de prueba

Crear un proyecto de ensayo (no sobrescribir juegos del usuario), escena con suelo sólido, spawn y cuatro eventos de prueba. Desde **Database → Objetos** crear:

- **Botella:** modelo o primitiva visible; Physics = `Dynamic`, masa 0.5 kg, colisión Caja.
- **Llave:** modelo o primitiva visible; Physics = `Static`.
- **Objeto fijo:** Physics = `Kinematic`.
- **Objeto visual:** Physics = `None`.

Crear también un arma nueva con Physics `Static`. Probar un registro legado creado **sin** la propiedad `physics` (o proyecto anterior). El registro antiguo debe conservar `page.solid` y su comportamiento previo; no se debe migrar automáticamente.

**Evento A, página 1:** gráfico = Botella de Database. Añadir el comando existente **Mover al View Model**, seguido de self-switch A = ON.  
**Evento A, página 2:** condición self-switch A. Gráfico = Llave de Database. No dar ni quitar inventario con los comandos de página.  
**Evento B:** gráfico = Objeto fijo, mover con un evento.  
**Evento C:** gráfico = Objeto visual.  
**Evento D:** gráfico = Botella; una página alternativa con gráfico Ninguno.

El evento cambia su gráfico y su perfil físico al cambiar de página. El inventario y la identidad del evento no cambian por ese solo hecho.

## 3. Matriz visual / funcional de aceptación (PHY-01..14)

| ID | Prueba concreta | Aceptación |
|---|---|---|
| PHY-01 | Crear Objeto y Arma nuevos | `Physics = Static` visible y guardado; Static no cae. |
| PHY-02 | Abrir un proyecto/registro anterior al campo | Sin física añadida por sorpresa; respetar `page.solid`. |
| PHY-03 | Colocar dos eventos Botella Dynamic | Ambos cuerpos reaccionan independientemente; mover uno no teletransporta el otro. |
| PHY-04 | Recoger Botella página 1 → self-switch A → página 2 Llave | Continúa en la mano el mismo evento; ahora se dibuja Llave. Inventario intacto si no hubo comando explícito. |
| PHY-05 | Soltar desde página 2 | La Llave queda en su posición, sin gravedad; no se recrea la Botella ni se duplica collider. |
| PHY-06 | Cambiar a gráfica Ninguno mientras está sostenido y soltar | No aparece el gráfico anterior ni existe collider invisible; los comandos del evento siguen disponibles según su disparador. |
| PHY-07 | Recoger y soltar Dynamic sin cambiar página | Suspendida física en mano; Jolt retoma el control al soltar; sin choque fantasma. |
| PHY-08 | Lanzar Dynamic | Jolt recibe el impulso, cae y choca; no hay trayectoria paralela propia. |
| PHY-09 | Lanzar un objeto legado sin `physics` | Se conserva la balística anterior. |
| PHY-10 | Evento con primitiva/prefab NO Database | Conserva colisiones previas y el tratamiento de `page.solid`. |
| PHY-11 | Recoger y soltar Static, Kinematic y None | Agarrar no los convierte en Rigidbody; lanzar físicamente uno no Dynamic no altera su perfil. |
| PHY-12 | Guardar/cargar tras mover varias instancias | Posición y velocidad por instancia y escena; comprobar también carga **sin abandonar** la escena. Restauración no emite señales de recogida falsas. |
| PHY-13 | Alternar páginas muchas veces, borrar evento y cambiar escenas | Sin fuga de cuerpos, doble colisión o pérdida de IDs. |
| PHY-14 | Repetir en modo Jugar, Player exportado y AppImage | Igualdad funcional y visual, sin errores de consola. Distinguir AppImage del editor del juego exportado. |

## 4. Límites y verificaciones pendientes

- Las 14 pruebas nuevas en Node comprueban esquema, contrato, referencias y conexiones del código. **No ejecutan Jolt/Three.js real**, ni reemplazan la matriz visual anterior.
- Los registros de Database comparten configuración física, **no** transform ni velocidad. No existen overrides por instancia en este Gate.
- Un gráfico `None` no crea cuerpo. El evento en mano puede seguir ocupando su slot sin mostrar gráfico.
- Dynamic requiere Jolt cargado; no se simula con la balística heredada como fallback. La función de lanzar en un perfil explícito Static/Kinematic/None rechaza la operación física sin convertirlo silenciosamente en Dynamic.
- Si la física parece distinta según el juego exportado, adjuntar captura, pasos precisos, consola y el modelo/gráfico implicado antes de aprobar el Gate.
- No presentar Vite, AppImage ni física real como PASS sin evidencia local.

## 5. Cierre

Adjuntar resultados de `node --test`, `npm run build` y la prueba visual de PHY-01 a PHY-14. La autorización de implementación ya consta, pero **LF-DB-PHY-G001 no se cierra automáticamente** por superar únicamente Node.
