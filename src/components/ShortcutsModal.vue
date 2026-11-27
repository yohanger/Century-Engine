<script setup>
import AppWindow from './AppWindow.vue'
import { store } from '../core/store.js'

const groups = [
  ['Navegar', [
    ['Orbitar', 'Rueda pulsada · Alt + arrastrar'], ['Desplazar', 'Shift + rueda pulsada · Espacio + arrastrar'], ['Zoom', 'Rueda · pellizco'],
    ['Volar', 'Clic derecho + W A S D'],
    ['Vista frontal · trasera', 'Num 1 · Ctrl Num 1'], ['Vista derecha · izquierda', 'Num 3 · Ctrl Num 3'], ['Vista superior · inferior', 'Num 7 · Ctrl Num 7'],
    ['Ortográfica / perspectiva', 'Num 5'], ['Perspectiva por defecto · vista opuesta', 'Num 0 · Num 9'],
    ['Orbitar en pasos de 15°', 'Num 2 4 6 8'], ['Desplazar', 'Ctrl Num 2 4 6 8'], ['Zoom · enfocar selección', 'Num + − · Num .'], ['Enfocar selección', 'F'], ['Mostrar / ocultar paneles', 'Shift + Tab'],
  ]],
  ['Herramientas', [
    ['Seleccionar · Mover · Rotar · Escalar', 'Q · W · E · R'], ['Pincel de terreno', 'B'], ['Radio del pincel', '[  ]'], ['Invertir elevar/bajar · pintar/borrar vegetación', 'Ctrl'],
    ['Espacio mundo / local', 'X'], ['Rejilla', 'G'],
  ]],
  ['Nodos y proyecto', [
    ['Añadir nodo', 'Shift A'], ['Instanciar escena existente', 'Ctrl Shift A'], ['Emparentar al activo · sacar del padre', 'Ctrl P · Alt P'], ['Unir mallas', 'Ctrl J'],
    ['Duplicar', 'Ctrl D'], ['Agrupar · Desagrupar', 'Ctrl G · Ctrl Shift G'], ['Renombrar · Eliminar', 'F2 · Supr'],
    ['Guardar en el navegador', 'Ctrl S'], ['Guardar / abrir proyecto .lfproj', 'Ctrl Shift S · Ctrl O'], /* ['Exportar a Godot', 'Ctrl B'] (obsoleto) */
  ]],
  ['Modo edición (Tab)', [
    ['Entrar / salir', 'Tab'], ['Vértice · arista · cara', '1 · 2 · 3'], ['Seleccionar / rectángulo', 'Clic · arrastrar'],
    ['Bucle · anillo de aristas', 'Alt + clic · Ctrl Alt + clic'], ['Todo · nada · invertir', 'A · Alt A · Ctrl I'], ['Enlazado · ampliar · reducir', 'L · Ctrl + · Ctrl −'],
    ['Mover · rotar · escalar', 'G · R · S (X Y Z fija el eje)'], ['Valor numérico', 'Escribir número + Enter'], ['Extruir · inset', 'E · I'],
    ['Bisel de aristas (rueda = segmentos · C = limitar solapes)', 'Ctrl B'], ['Bisel de vértices (rueda = segmentos)', 'Ctrl Shift B'], ['Corte en bucle (rueda = cortes)', 'Ctrl R'], ['Cuchillo', 'K'], ['Rellenar', 'F'],
    ['Fusionar · dividir · abrir', 'M · Y · V'], ['Separar', 'P'], ['Duplicar geometría', 'Shift D'], ['Eliminar · disolver', 'X · Ctrl X'],
    ['Invertir · recalcular normales', 'Alt N · Shift N'], ['Encoger / engordar', 'Alt S'], ['Proporcional · X-ray', 'O · Alt Z'],
    ['Ocultar · todo visible', 'H · Alt H'], ['Triangular', 'Ctrl T'], ['Añadir geometría', 'Shift A'],
  ]],
  ['Panel Proyecto', [
    ['Seleccionar varios', 'Ctrl + clic · Shift + clic · Ctrl A'], ['Mover a otra carpeta', 'Arrastrar (también carpetas)'], ['Renombrar', 'F2 · segundo clic en el nombre'],
    ['Duplicar · Eliminar', 'Ctrl D · Supr'], ['Crear prefab', 'Arrastrar nodos de la Jerarquía a una carpeta'], ['Instanciar prefab', 'Arrastrar al viewport · doble clic'],
    ['Filtrar por tipo', 't:prefab · t:texture · t:model · t:scene'],
  ]],
  ['General', [
    ['Paleta de comandos', 'Ctrl K'], ['Herramientas de desarrollo (solo editor)', 'F12'], ['Deshacer · Rehacer', 'Ctrl Z · Ctrl Shift Z'], ['Seleccionar todo', 'Ctrl A'],
  ]],
]
</script>

<template>
  <AppWindow title="Atajos de teclado" :width="760" :min-width="340" :min-height="220" persist="shortcuts" @close="store.modal = null">
      <div class="body cols">
        <section v-for="[title, rows] in groups" :key="title">
          <h3>{{ title }}</h3>
          <div v-for="[a, b] in rows" :key="a" class="r"><span>{{ a }}</span><span class="b">{{ b }}</span></div>
        </section>
      </div>
    <template #footer><span style="flex:1"></span><button class="primary" @click="store.modal = null">Cerrar</button></template>
  </AppWindow>
</template>

<style scoped>
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 18px 28px; padding: 14px 18px; }
h3 { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--text-2); }
.r { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--hair-soft); }
.b { color: var(--text-3); text-align: right; }
</style>
