# Tutorial: script asociado a un nodo

## Preparar un recurso

1. Crea un `Node3D`.
2. En **Assets → Crear**, selecciona **Script de Nodo (.js)** y nómbralo.
3. Selecciona el nodo y asigna el recurso desde **Scripts** en el Inspector.
4. Haz doble clic en el `.js` desde Assets y pega el ejemplo en el editor de código integrado.

```js
let elapsed = 0

function _ready() {
  console.log('Se preparó:', node.name)
}

function _process(delta) {
  elapsed += delta
  if (elapsed >= 1) {
    console.log('Un segundo activo en', node.name)
    elapsed = 0
  }
}
```

## Verificar el ciclo

Guarda el proyecto desde el editor integrado. Inicia Play y revisa la Consola. Si asignas el mismo recurso a otro nodo, ambos tendrán contadores independientes.

## Paso físico

Para operaciones de tiempo fijo utiliza `_physics_process(delta)` en vez de `_process` y recuerda que el runtime coordina el paso Jolt.

## Limpiar

Usa `_exit_tree()` para liberar suscripciones creadas por el script. Las promesas asíncronas iniciadas no se cancelan automáticamente.
