// CSV para Excel em português: separador ";", BOM UTF-8 e quebra CRLF.

export interface ColunaCsv<T> {
  chave: keyof T & string
  titulo: string
  formatar?: (valor: T[keyof T]) => string
}

function celula(valor: string): string {
  // Evita que a planilha execute fórmula vinda do dado
  let v = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor
  if (/[";\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`
  return v
}

export function gerarCsv<T extends Record<string, unknown>>(linhas: T[], colunas: ColunaCsv<T>[]): string {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(';')
  const corpo = linhas.map((linha) =>
    colunas
      .map((c) => {
        const bruto = linha[c.chave]
        if (bruto === null || bruto === undefined) return ''
        return celula(c.formatar ? c.formatar(bruto) : String(bruto))
      })
      .join(';'),
  )
  return '﻿' + [cabecalho, ...corpo].join('\r\n') + '\r\n'
}
