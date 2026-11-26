// Gasto gravado: avisa a navegação para o + quicar (docs/02_DESIGN_SYSTEM/cartoon, Movimento).
// Dispara só no sucesso da gravação, nunca no toque.
const EVENTO = 'rota:gasto-salvo'

export function avisarGastoSalvo() {
  window.dispatchEvent(new Event(EVENTO))
}

export function aoSalvarGasto(fazer: () => void): () => void {
  window.addEventListener(EVENTO, fazer)
  return () => window.removeEventListener(EVENTO, fazer)
}
