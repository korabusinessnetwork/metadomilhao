import { traduzirErro } from '../services/resultado'
import type { ResultadoEnvio } from './fila'

/**
 * Traduz a resposta do banco para a fila:
 * - 23505 no id: um envio anterior já chegou, então não duplica;
 * - rede ou sessão vencida: fica na fila para tentar de novo;
 * - o resto é recusa por regra, com o motivo para o dono ver.
 */
export function classificarEnvio(erro: { code?: string; message?: string } | null): ResultadoEnvio {
  if (!erro) return 'enviado'
  if (erro.code === '23505') return 'ja_existe'
  const msg = erro.message ?? ''
  if (erro.code === 'PGRST301' || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return 'sem_conexao'
  return { recusado: traduzirErro(erro) }
}
