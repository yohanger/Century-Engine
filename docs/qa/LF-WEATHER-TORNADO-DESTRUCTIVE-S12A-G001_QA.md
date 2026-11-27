# QA — LF-WEATHER-TORNADO-DESTRUCTIVE-S12A-G001

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · QA LOCAL PENDIENTE · NO CERRADO.
**Amendments:** CA-004 (agua suspendida) y contrato S12A (combustión).

## Evidencia automatizada obtenida

- `node --test scripts/test-weather-tornado-destructive-s12a-g001.mjs`: **57/57 PASS**, 0 FAIL; abarca condiciones de resistencia, agua finita, frontera oceánica, conservación, snapshot v7, coexistencia con recipientes S10, combustible/temperatura/humedad, brasas, presupuestos, VFX sin emisión en reposo y contactos de depósito.
- `npm run test:weather-tornado-destructive`: **517 pruebas: 508 PASS, 0 FAIL, 9 SKIP**. Regresión sobre S12/S11, LIQUID S05–S10, WATER, AUDIO, WIND, Jolt-nodos, VFX ejecutables sin dependencias opcionales.
- `node --check` en archivos JavaScript nuevos y modificados: ver resultado de ejecución, se exige cero errores.
- Las nueve pruebas SKIP requieren dependencias que no están presentes; NO equivalen a PASS.
- Vite, documentación HTML, Electron, Jolt wasm real, Player exportado y FPS/RAM: NO VERIFICADOS en el entorno de implementación (deben verificarse localmente).

## QA local obligatorio — escenarios funcionales

1. `npm ci`, `npm run test:weather-tornado-destructive`, `npm run docs:build`, `npm run docs:check`, `npm run build`, `npm run electron`.
2. Terrain con árboles integrados: tipo destructible, raíz fuerte / tronco fuerte. Tornado débil no debe desprenderlos; incrementar intensidad hasta superar el esfuerzo: instancia original desaparece **solo en Play** y Jolt crea fragmentos físicos; tras Stop reaparece intacta.
3. Árbol procedural separable: verificar desprendimiento de tronco/copa, fuerzas, colisiones y ausencia de duplicados. Modelo importado: desprendimiento completo o diagnóstico, sin fractura inventada.
4. Desactivar LOD en el editor y repetir el desprendimiento. Verificar que el índice espacial permite un escenario con numerosos árboles sin crear un RigidBody para cada uno.
5. Activar «Agua suspendida», colocar tornado sobre región WATER finita y después sobre océano heredado. Comprobar inventario, gotas transportadas y regreso/registro de salida, sin pérdida inexplicada ni descenso de océano heredado como depósito finito.
6. Fuente combustible seca con `combustion.enabled`/`ignited`; configurar VFX3D de brasas. Debe emitir fuego solo mientras exista un foco y debe detener emisión al apagarse. Repetir con lluvia, contacto de agua y agua depositada: baja temperatura y se extingue.
7. Impacto físico de rayo S11 próximo a fuente compatible: comprobar evento y posibilidad de ignición. Fuente no combustible o muy húmeda no debe encenderse indebidamente. Brasas pueden propagarse solo a fuentes compatibles.
8. Guardar y restaurar partida con árboles desprendidos, agua suspendida y brasas; verificar poses, velocidades, estados térmicos y volúmenes. Pausar/reanudar, Play/Stop, cambio de escena, Film Maker y exportación Player.
9. Reducir VFX a mínimo y luego incrementar partículas: la masa física y los eventos deben permanecer iguales. Registrar FPS, CPU y RAM en equipo de 4 GB y verificar presupuestos de 64 fuentes / 96 brasas / 64 paquetes de agua.
10. Regresión de lluvia, hidrología, charcos, recipientes de café, rayos, truenos y tornado S12; sin nuevas superficies duplicadas ni cambios de nodos heredados.

**Evidencia a devolver:** logs completos de Node/docs/build, capturas del tipo de vegetación/Clima/Inspector/VFX3D, video de árbol arrancado y restauración Play/Stop, video de agua depositada/ignición, resultados de Player, FPS/RAM. Compilation/Node PASS no sustituyen QA visual y de física.
