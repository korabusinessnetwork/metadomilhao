// Armazenamento no aparelho (localStorage). Toda leitura e escrita é protegida: em janela anônima ou com o
// armazenamento bloqueado o app continua funcionando, só sem a fila offline.
import { criarFila, type Armazenamento } from './fila'

const armazenamento: Armazenamento = {
  ler(chave) {
    try {
      return window.localStorage.getItem(chave)
    } catch {
      return null
    }
  },
  gravar(chave, valor) {
    try {
      window.localStorage.setItem(chave, valor)
    } catch {
      // sem espaço ou bloqueado: segue sem cache
    }
  },
  apagar(chave) {
    try {
      window.localStorage.removeItem(chave)
    } catch {
      // idem
    }
  },
}

export const fila = criarFila(armazenamento)

const PREFIXO_CACHE = 'rota:cache:'

/** Cache do último dado bom, para o app abrir sem conexão. Fica só neste aparelho e é apagado ao sair. */
export const cache = {
  ler<T>(nome: string): T | null {
    try {
      const v = armazenamento.ler(PREFIXO_CACHE + nome)
      return v ? (JSON.parse(v) as T) : null
    } catch {
      return null
    }
  },
  gravar(nome: string, valor: unknown) {
    armazenamento.gravar(PREFIXO_CACHE + nome, JSON.stringify(valor))
  },
  limpar() {
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith(PREFIXO_CACHE))
        .forEach((k) => armazenamento.apagar(k))
    } catch {
      // nada a limpar
    }
  },
}

export function novoId(): string {
  return crypto.randomUUID()
}

/** Evento para as telas atualizarem o indicador quando a fila muda. */
export const EVENTO_FILA = 'rota:fila-mudou'
export const avisarFilaMudou = () => window.dispatchEvent(new Event(EVENTO_FILA))
