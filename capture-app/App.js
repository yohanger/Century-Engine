// Century Capture — captura de movimiento con el móvil para Century.
//   Biblioteca → Grabar (cuerpo con IA + cámara del móvil) → Editor (recorte, tomas, suavizado, cámara, efectos) → .lfcap
import React, { useState } from 'react'
import { View, StatusBar as RNStatusBar, Platform } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import Home from './src/screens/Home.js'
import Record from './src/screens/Record.js'
import Editor from './src/screens/Editor.js'
import { C } from './src/theme.js'

export default function App() {
  const [route, setRoute] = useState({ screen: 'home', id: null })
  const go = (screen, id = null) => setRoute({ screen, id })
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : Platform.OS === 'web' ? 0 : 44 }}>
      <StatusBar style="light" />
      {route.screen === 'home' ? <Home go={go} /> : null}
      {route.screen === 'record' ? <Record go={go} /> : null}
      {route.screen === 'editor' ? <Editor key={route.id} id={route.id} go={go} /> : null}
    </View>
  )
}
