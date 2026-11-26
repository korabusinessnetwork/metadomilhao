import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import './estilos/base.css'

// BUG-008: com o service worker, o app ficava na versão antiga até o segundo recarregamento.
// Com autoUpdate, quando a versão nova assume, a página recarrega sozinha; e o app aberto confere a cada hora.
const UMA_HORA = 60 * 60 * 1000
registerSW({
  immediate: true,
  onRegisteredSW(_url, registro) {
    if (registro) window.setInterval(() => void registro.update(), UMA_HORA)
  },
})

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
