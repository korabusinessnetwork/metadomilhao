import { describe, expect, it } from 'vitest'
import { gerarCsv } from './csv'

describe('exportação CSV', () => {
  it('usa ponto e vírgula, BOM e escapa aspas', () => {
    const csv = gerarCsv(
      [{ data: '2027-03-01', descricao: 'Café; "bom"', valor: 1250 }],
      [
        { chave: 'data', titulo: 'Data' },
        { chave: 'descricao', titulo: 'Descrição' },
        { chave: 'valor', titulo: 'Valor (R$)', formatar: (v) => (Number(v) / 100).toFixed(2).replace('.', ',') },
      ],
    )
    expect(csv).toBe('﻿Data;Descrição;Valor (R$)\r\n2027-03-01;"Café; ""bom""";12,50\r\n')
  })

  it('neutraliza fórmula de planilha no começo do texto', () => {
    const csv = gerarCsv([{ d: '=1+1' }], [{ chave: 'd', titulo: 'D' }])
    expect(csv).toContain("'=1+1")
  })

  it('campo nulo vira vazio', () => {
    expect(gerarCsv([{ d: null }], [{ chave: 'd', titulo: 'D' }])).toBe('﻿D\r\n\r\n')
  })
})
