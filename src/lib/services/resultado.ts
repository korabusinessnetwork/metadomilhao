// Todo serviço devolve { dados, erro }. O erro já vem em linguagem humana e sem valores financeiros.

export type Resultado<T> = { dados: T; erro: null } | { dados: null; erro: string }

interface ErroBanco {
  code?: string
  message?: string
}

const MENSAGENS: Record<string, string> = {
  '23505': 'Esse registro já existe.',
  '23514': 'Algum valor está fora do permitido.',
  '23503': 'Esse item está em uso e não pode ser removido.',
  '42501': 'Sem permissão. Entre de novo com o segundo fator.',
  PGRST301: 'Sua sessão expirou. Entre de novo.',
}

export function traduzirErro(erro: ErroBanco | null | undefined): string {
  if (!erro) return 'Algo deu errado. Tente de novo.'
  // P0001: mensagens escritas por nós nos triggers, já em português e sem dados sensíveis
  if (erro.code === 'P0001' && erro.message) return erro.message
  if (erro.code && MENSAGENS[erro.code]) return MENSAGENS[erro.code]!
  if (erro.message?.includes('Failed to fetch')) return 'Sem conexão. Confira a internet e tente de novo.'
  return 'Algo deu errado. Tente de novo.'
}

export function ok<T>(dados: T): Resultado<T> {
  return { dados, erro: null }
}

export function falha<T>(erro: ErroBanco | null | undefined): Resultado<T> {
  return { dados: null, erro: traduzirErro(erro) }
}

export async function executar<T>(promessa: PromiseLike<{ data: T | null; error: ErroBanco | null }>): Promise<Resultado<T>> {
  try {
    const { data, error } = await promessa
    if (error) return falha(error)
    return ok(data as T)
  } catch (e) {
    return falha({ message: e instanceof Error ? e.message : '' })
  }
}
