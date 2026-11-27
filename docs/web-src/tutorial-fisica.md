# Tutorial: cuerpos y colisiones

Este ejercicio crea una caja con gravedad y un suelo sólido mediante nodos especializados.

## Estructura

```text
Level (Node3D)
├── Ground (StaticBody3D)
│   ├── MeshInstance / Cube
│   └── BoxShape3D
└── Crate (RigidBody3D)
    ├── MeshInstance / Cube
    └── BoxShape3D
```

## Pasos

1. Añade un `StaticBody3D` y una forma `BoxShape3D` directamente debajo.
2. Añade primero la primitiva visual con dimensiones reales; al crear una nueva BoxShape3D, comprueba el **Autoajuste a geometría**. Si ya existía, selecciona «Ajustar a geometría» desde el Inspector.
3. Añade la geometría visual como descendiente del cuerpo.
4. Crea un `RigidBody3D` con una `BoxShape3D` y una malla visual.
5. Coloca la caja sobre el suelo; inicia PlayMode.

## Resultado

La caja debe caer y colisionar, mientras que una primitiva sin cuerpo debe carecer de colisión. Si no ocurre, revisa el parentesco de las formas y los errores de consola.

> La ejecución con Jolt WASM y el Player exportado requiere comprobación real en tu instalación; no basta con el marcador visual del editor.
