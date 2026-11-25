// Fila offline de lançamentos (Fase 4). Sem conexão, o gasto fica no aparelho e sobe quando a conexão volta.
// O id é gerado no aparelho: reenviar o mesmo lançamento nunca duplica (o banco recusa o id repetido).

export interface Armazenamento {
  ler(chave: string): string | null
  gravar(chave: string, valor: string): void
  apagar(chave: string): void
}

export interface LancamentoPendente {
  id: string
  data: string
  categoriaId: string
  valorCentavos: number
  descricao: string
  criadoEm: string
}

export type LancamentoRecusado = LancamentoPendente & { motivo: string }

/** 'ja_existe' = o banco já tem esse id (um envio anterior chegou). Recusa por regra traz o motivo. */
export type ResultadoEnvio = 'enviado' | 'ja_existe' | 'sem_conexao' | { recusado: string }

export interface ResumoSincronizacao {
  enviados: number
  recusados: number
  pendentes: number
}

const CHAVE_PENDENTES = 'rota:fila:pendentes'
const CHAVE_RECUSADOS = 'rota:fila:recusados'

function lerLista<T>(arm: Armazenamento, chave: string): T[] {
  try {
    const bruto = arm.ler(chave)
    const v = bruto ? JSON.parse(bruto) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function criarFila(arm: Armazenamento) {
  let emAndamento: Promise<ResumoSincronizacao> | null = null
  const pendentes = () => lerLista<LancamentoPendente>(arm, CHAVE_PENDENTES)
  const recusados = () => lerLista<LancamentoRecusado>(arm, CHAVE_RECUSADOS)
  const gravarPendentes = (l: LancamentoPendente[]) => arm.gravar(CHAVE_PENDENTES, JSON.stringify(l))
  const gravarRecusados = (l: LancamentoRecusado[]) => arm.gravar(CHAVE_RECUSADOS, JSON.stringify(l))

  async function executar(enviar: (l: LancamentoPendente) => Promise<ResultadoEnvio>): Promise<ResumoSincronizacao> {
    let enviados = 0
    let recusadosAgora = 0
    for (const l of pendentes()) {
      const r = await enviar(l)
      if (r === 'sem_conexao') break
      // Tira da fila só depois da resposta, e lendo de novo (um lançamento novo pode ter entrado no meio)
      gravarPendentes(pendentes().filter((p) => p.id !== l.id))
      if (r === 'enviado' || r === 'ja_existe') enviados++
      else {
        gravarRecusados([...recusados(), { ...l, motivo: r.recusado }])
        recusadosAgora++
      }
    }
    return { enviados, recusados: recusadosAgora, pendentes: pendentes().length }
  }

  return {
    pendentes,
    recusados,
    adicionar(l: LancamentoPendente) {
      gravarPendentes([...pendentes().filter((p) => p.id !== l.id), l])
    },
    /** Envia na ordem de lançamento. Para no primeiro "sem conexão". Uma sincronização por vez. */
    sincronizar(enviar: (l: LancamentoPendente) => Promise<ResultadoEnvio>): Promise<ResumoSincronizacao> {
      if (!emAndamento) emAndamento = executar(enviar).finally(() => (emAndamento = null))
      return emAndamento
    },
    descartarRecusado(id: string) {
      gravarRecusados(recusados().filter((r) => r.id !== id))
    },
    limpar() {
      arm.apagar(CHAVE_PENDENTES)
      arm.apagar(CHAVE_RECUSADOS)
    },
  }
}

export type Fila = ReturnType<typeof criarFila>
