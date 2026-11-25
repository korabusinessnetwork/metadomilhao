import { describe, expect, it } from 'vitest'
import { conferirLucro, decodificarRelatorio, lerRelatorioMt5 } from './mt5'

// Relatório no formato do MT5 (Histórico, Relatório, HTML): título da seção numa linha, cabeçalho, posições, outra seção.
const relatorioIngles = `<html><body><table>
<tr><th colspan="13"><div><b>Trade History Report</b></div></th></tr>
<tr><td colspan="13"><b>Positions</b></td></tr>
<tr bgcolor="#E5F0FC"><td>Time</td><td>Position</td><td>Symbol</td><td>Type</td><td>Volume</td><td>Price</td><td>S / L</td><td>T / P</td><td>Time</td><td>Price</td><td>Commission</td><td>Swap</td><td>Profit</td></tr>
<tr><td>2027.03.10 10:15:32</td><td>1001</td><td>WINJ27</td><td>buy</td><td>2</td><td>128 500</td><td>128 450</td><td>128 600</td><td>2027.03.10 10:42:05</td><td>128 600</td><td>-1.10</td><td>0.00</td><td>40.00</td></tr>
<tr><td>2027.03.10 11:00:00</td><td>1002</td><td>petr4</td><td>sell</td><td>100</td><td>32.15</td><td></td><td>0</td><td>2027.03.10 11:30:00</td><td>31.90</td><td>-0.35</td><td>-0.05</td><td>25.00</td></tr>
<tr><td>2027.13.40 11:00:00</td><td>1003</td><td>VALE3</td><td>buy</td><td>100</td><td>60.00</td><td></td><td></td><td>2027.03.10 11:30:00</td><td>61.00</td><td>0.00</td><td>0.00</td><td>100.00</td></tr>
<tr><td colspan="13"><b>Orders</b></td></tr>
<tr><td>Open Time</td><td>Order</td><td>Symbol</td><td>Type</td><td>Volume</td><td>Price</td><td>S / L</td><td>T / P</td><td>Time</td><td>State</td><td>Comment</td></tr>
<tr><td>2027.03.10 10:15:32</td><td>5001</td><td>WINJ27</td><td>buy</td><td>2 / 2</td><td>market</td><td></td><td></td><td>2027.03.10 10:15:32</td><td>filled</td><td></td></tr>
</table></body></html>`

const relatorioPortugues = `<html><body><table>
<tr><td colspan="13"><b>Posições</b></td></tr>
<tr><td>Horário</td><td>Posição</td><td>Ativo</td><td>Tipo</td><td>Volume</td><td>Preço</td><td>S / L</td><td>T / P</td><td>Horário</td><td>Preço</td><td>Comissão</td><td>Swap</td><td>Lucro</td></tr>
<tr><td>2027.03.11 09:05:00</td><td>2001</td><td>WINJ27</td><td>venda</td><td>1</td><td>129&nbsp;000</td><td>129&#160;050</td><td>128 900</td><td>2027.03.11 09:20:00</td><td>129 050</td><td>-0.55</td><td>0.00</td><td>-10.00</td></tr>
<tr><td colspan="13"><b>Transações</b></td></tr>
<tr><td>Saldo:</td><td>1 000.00</td></tr>
</table></body></html>`

describe('conferência do lucro do MT5', () => {
  it('bate quando o lucro do relatório é o calculado pelos preços e pelo multiplicador (T-03)', () => {
    const r = lerRelatorioMt5(relatorioIngles)
    expect(conferirLucro(r.posicoes[0]!)).toEqual({ calculadoCentavos: 4000, diferencaCentavos: 0 })
  })

  it('aponta a diferença quando não bate (ex.: contrato com multiplicador diferente)', () => {
    const p = { ...lerRelatorioMt5(relatorioIngles).posicoes[0]!, lucroBrutoCentavos: 20000 }
    expect(conferirLucro(p)).toEqual({ calculadoCentavos: 4000, diferencaCentavos: 16000 })
  })
})

describe('relatório de histórico do MT5', () => {
  it('lê as posições em inglês: ativo, direção, volume, preços, S/L, T/P, horários, custos e lucro', () => {
    const r = lerRelatorioMt5(relatorioIngles)
    expect(r.posicoes).toHaveLength(2)
    expect(r.posicoes[0]).toEqual({
      linha: 4,
      ticket: '1001',
      ativo: 'WINJ27',
      direcao: 'compra',
      volume: 2,
      precoEntrada: 128500,
      precoSaida: 128600,
      stop: 128450,
      alvo: 128600,
      abertaEm: '2027-03-10T10:15:32-03:00',
      fechadaEm: '2027-03-10T10:42:05-03:00',
      custosCentavos: 110,
      lucroBrutoCentavos: 4000,
    })
    expect(r.posicoes[1]).toMatchObject({ ticket: '1002', ativo: 'PETR4', direcao: 'venda', volume: 100, precoEntrada: 32.15, precoSaida: 31.9, stop: null, alvo: null, custosCentavos: 40, lucroBrutoCentavos: 2500 })
  })

  it('linha ilegível vira aviso com o número da linha e o motivo, e as outras continuam', () => {
    const r = lerRelatorioMt5(relatorioIngles)
    expect(r.avisos).toEqual(['Linha 6 ignorada: data inválida (2027.13.40 11:00:00).'])
  })

  it('tipo desconhecido e número inválido também viram aviso', () => {
    const html = relatorioPortugues
      .replace('<td>venda</td>', '<td>balance</td>')
      .replace('</tr>\n<tr><td colspan="13"><b>Transações', '</tr>\n<tr><td>2027.03.11 10:00:00</td><td>2002</td><td>WINJ27</td><td>compra</td><td>um</td><td>129 000</td><td></td><td></td><td>2027.03.11 10:10:00</td><td>129 100</td><td>0</td><td>0</td><td>20.00</td></tr>\n<tr><td colspan="13"><b>Transações')
    const r = lerRelatorioMt5(html)
    expect(r.posicoes).toEqual([])
    expect(r.avisos).toEqual(['Linha 3 ignorada: tipo desconhecido (balance).', 'Linha 4 ignorada: volume inválido (um).'])
  })

  it('para no fim da seção de posições e não mistura a tabela de ordens', () => {
    expect(lerRelatorioMt5(relatorioIngles).posicoes.map((p) => p.ticket)).toEqual(['1001', '1002'])
  })

  it('lê o relatório em português, com espaço não quebrável no milhar', () => {
    const r = lerRelatorioMt5(relatorioPortugues)
    expect(r.avisos).toEqual([])
    expect(r.posicoes).toEqual([
      expect.objectContaining({ ticket: '2001', direcao: 'venda', precoEntrada: 129000, stop: 129050, alvo: 128900, precoSaida: 129050, custosCentavos: 55, lucroBrutoCentavos: -1000 }),
    ])
  })

  it('acha as colunas pelo cabeçalho, mesmo fora da ordem padrão', () => {
    const fora = `<table><tr><td>Positions</td></tr>
<tr><td>Symbol</td><td>Position</td><td>Type</td><td>Time</td><td>Price</td><td>Volume</td><td>S / L</td><td>T / P</td><td>Time</td><td>Price</td><td>Profit</td><td>Commission</td><td>Swap</td></tr>
<tr><td>WINJ27</td><td>9</td><td>buy</td><td>2027.03.10 10:00:00</td><td>100 000</td><td>1</td><td>99 950</td><td>100 100</td><td>2027.03.10 10:05:00</td><td>100 100</td><td>20.00</td><td>-0.50</td><td>0</td></tr></table>`
    expect(lerRelatorioMt5(fora).posicoes[0]).toMatchObject({ ativo: 'WINJ27', ticket: '9', precoEntrada: 100000, volume: 1, lucroBrutoCentavos: 2000, custosCentavos: 50 })
  })

  it('sem tabela de posições: lista vazia e aviso, sem exceção', () => {
    expect(lerRelatorioMt5('<html><body>Outro arquivo</body></html>')).toEqual({
      posicoes: [],
      avisos: ['Não achei a tabela de posições. Salve no MT5 pela aba Histórico, botão direito, Relatório, HTML.'],
    })
    expect(lerRelatorioMt5('')).toMatchObject({ posicoes: [] })
  })

  it('tags e entidades dentro das células não atrapalham', () => {
    const r = lerRelatorioMt5(relatorioIngles.replace('<td>WINJ27</td>', '<td><span class="x">WINJ27</span></td>').replace('<td>1001</td>', '<td>&#49;001</td>'))
    expect(r.posicoes[0]).toMatchObject({ ativo: 'WINJ27', ticket: '1001' })
  })

  it('decodifica UTF-16LE com BOM (como o MT5 salva), UTF-8 com BOM e UTF-8 puro', () => {
    const texto = '<td>Posições</td>'
    const utf16 = new Uint8Array([0xff, 0xfe, ...Array.from(texto).flatMap((c) => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8])])
    expect(decodificarRelatorio(utf16)).toBe(texto)
    const utf8 = new TextEncoder().encode(texto)
    expect(decodificarRelatorio(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe(texto)
    expect(decodificarRelatorio(utf8)).toBe(texto)
  })
})
