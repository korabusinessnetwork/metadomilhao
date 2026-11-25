import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))
const { validarContexto } = await import('./importacaoService')

const completo = {
  setup_id: 's1', tendencia_diario: 'alta', tendencia_h1: 'baixa', tendencia_h4: 'lateral', timeframe_entrada: '5m',
  teve_noticia: false, noticia_descricao: '', seguiu_plano: true, observacao: '',
} as const

describe('contexto da operação importada (T-02)', () => {
  it('completo passa', () => {
    expect(validarContexto({ ...completo })).toEqual([])
  })

  it('cobra setup, tendências, timeframe e descrição da notícia', () => {
    expect(validarContexto({ ...completo, setup_id: '', tendencia_h4: '', timeframe_entrada: '', teve_noticia: true })).toEqual([
      'Escolha o setup (T-02).',
      'Informe a tendência no diário, H1 e H4 (T-02).',
      'Informe o timeframe de entrada (T-02).',
      'Descreva a notícia (T-02).',
    ])
  })
})
