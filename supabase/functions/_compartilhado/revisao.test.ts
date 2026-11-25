import { describe, expect, it } from 'vitest'
import { montarPromptUsuario, extrairJson, validarRevisao, custoEstimadoCentavos, situacaoDoTeto, PROMPT_SISTEMA } from './revisao.ts'

const valida = {
  data: '2027-03-10',
  agenda: [{ hora: '09:00', evento: 'IPCA de fevereiro', pais: 'BR', relevancia: 'alta' }],
  ativos: [
    {
      ativo: 'PETR4',
      noticias: [
        { titulo: 'Petrobras anuncia dividendos', resumo: 'Conselho aprovou...', fonte: 'Valor', url: 'https://valor.globo.com/x' },
        { titulo: 'Sem fonte', resumo: 'boato', fonte: '', url: '' },
      ],
      possivel_impacto: 'Possível impacto positivo na abertura.',
      riscos_do_dia: ['Petróleo em queda'],
      sem_novidades: false,
    },
  ],
  contexto_geral: 'Mercado atento ao IPCA.',
}

describe('revisão de notícias (docs/10_PROMPTS, IA-01 a IA-04)', () => {
  it('o prompt do sistema proíbe recomendação (IA-02)', () => {
    expect(PROMPT_SISTEMA).toContain('Nunca recomende comprar, vender ou manter')
  })

  it('monta o prompt do usuário só com a data e a watchlist, sem dado financeiro pessoal', () => {
    const p = montarPromptUsuario('2027-03-10', [
      { ativo: 'PETR4', mercado: 'acoes' },
      { ativo: 'WINJ27', mercado: 'mini_indice' },
    ])
    expect(p).toContain('Data: 2027-03-10 (America/Sao_Paulo)')
    expect(p).toContain('PETR4 (ações), WINJ27 (mini-índice)')
    expect(p).toContain('agenda macro do dia no Brasil e nos EUA')
    expect(p).not.toMatch(/R\$|capital|saldo/)
  })

  it('extrai o JSON mesmo cercado de texto ou de bloco de código', () => {
    expect(extrairJson('Aqui está:\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extrairJson('{"a":{"b":2}} fim')).toEqual({ a: { b: 2 } })
    expect(extrairJson('sem json')).toBeNull()
    expect(extrairJson('{quebrado')).toBeNull()
  })

  it('valida o schema e descarta item sem fonte', () => {
    const r = validarRevisao(valida, '2027-03-10')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.revisao.ativos[0]!.noticias).toHaveLength(1)
    expect(r.fontes).toEqual([{ fonte: 'Valor', url: 'https://valor.globo.com/x' }])
  })

  it('reprova recomendação explícita de compra ou venda (IA-02)', () => {
    const r = validarRevisao({ ...valida, contexto_geral: 'Compre PETR4 na abertura.' }, '2027-03-10')
    expect(r).toEqual({ ok: false, erro: 'A resposta contém recomendação de compra ou venda.' })
    const r2 = validarRevisao({ ...valida, ativos: [{ ...valida.ativos[0]!, possivel_impacto: 'Melhor vender antes do leilão.' }] }, '2027-03-10')
    expect(r2.ok).toBe(false)
  })

  it('não confunde "vendas no varejo" ou "comprador" com recomendação', () => {
    const r = validarRevisao({ ...valida, contexto_geral: 'Dados de vendas no varejo e fluxo comprador estrangeiro.' }, '2027-03-10')
    expect(r.ok).toBe(true)
  })

  it('recusa estrutura inválida com o motivo', () => {
    expect(validarRevisao({ ...valida, ativos: 'x' }, '2027-03-10')).toEqual({ ok: false, erro: 'Campo "ativos" precisa ser uma lista.' })
    expect(validarRevisao(null, '2027-03-10')).toEqual({ ok: false, erro: 'Resposta não é um objeto JSON.' })
    expect(validarRevisao({ ...valida, data: '2027-03-09' }, '2027-03-10')).toEqual({ ok: false, erro: 'A revisão é de outra data.' })
  })

  it('IA-04: custo estimado em centavos de real a partir do uso', () => {
    // 40.000 tokens de entrada a US$ 0,10/M = 0,004; 3.000 de saída a 0,50/M = 0,0015; 5 buscas a 0,01 = 0,05
    // total US$ 0,0555 × 5,60 = R$ 0,3108 → 32 centavos (arredonda para cima: nunca subestimar)
    expect(
      custoEstimadoCentavos(
        { tokensEntrada: 40000, tokensSaida: 3000, buscas: 5 },
        { precoEntradaUsdPorMilhao: 0.1, precoSaidaUsdPorMilhao: 0.5, precoBuscaUsd: 0.01, cotacaoUsdBrl: 5.6 },
      ),
    ).toBe(32)
  })

  it('IA-03: aviso aos 80% e bloqueio aos 100% do teto', () => {
    expect(situacaoDoTeto(2399, 3000)).toBe('ok')
    expect(situacaoDoTeto(2400, 3000)).toBe('aviso')
    expect(situacaoDoTeto(2999, 3000)).toBe('aviso')
    expect(situacaoDoTeto(3000, 3000)).toBe('bloqueado')
    expect(situacaoDoTeto(10, 0)).toBe('bloqueado')
  })
})
