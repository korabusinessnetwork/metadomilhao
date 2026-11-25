// Datas de calendário como texto 'AAAA-MM-DD'. Toda regra de dia e mês usa America/Sao_Paulo.

export const FUSO = 'America/Sao_Paulo'

const formatadorData = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

export function dataEmSaoPaulo(instante: Date = new Date()): string {
  return formatadorData.format(instante)
}

function partes(data: string): [number, number, number] {
  const [a, m, d] = data.split('-').map(Number)
  return [a!, m!, d!]
}

function texto(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const [a, m, d] = partes(data)
  return m >= 1 && m <= 12 && d >= 1 && d <= diasNoMes(a, m)
}

export function inicioDoMes(data: string): string {
  const [a, m] = partes(data)
  return texto(a, m, 1)
}

export function ultimoDiaDoMes(data: string): string {
  const [a, m] = partes(data)
  return texto(a, m, diasNoMes(a, m))
}

/** Dias que faltam no mês, contando o próprio dia. */
export function diasRestantesNoMes(data: string): number {
  const [a, m, d] = partes(data)
  return diasNoMes(a, m) - d + 1
}

export function somarMeses(data: string, quantidade: number): string {
  const [a, m] = partes(data)
  const total = a * 12 + (m - 1) + quantidade
  return texto(Math.floor(total / 12), (total % 12) + 1, 1)
}

/** Quantos meses de `de` até `ate`, considerando só ano e mês. */
export function mesesEntre(de: string, ate: string): number {
  const [a1, m1] = partes(de)
  const [a2, m2] = partes(ate)
  return (a2 * 12 + m2) - (a1 * 12 + m1)
}

export function diaDoMes(data: string): number {
  return partes(data)[2]
}

/** 0 = domingo ... 6 = sábado, para uma data de calendário. */
export function diaDaSemana(data: string): number {
  const [a, m, d] = partes(data)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = partes(data)
  const x = new Date(Date.UTC(a, m - 1, d + dias))
  return texto(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate())
}

/** Semana começa na segunda (memory/patterns.md). */
export function inicioDaSemana(data: string): string {
  const dia = diaDaSemana(data)
  return somarDias(data, dia === 0 ? -6 : 1 - dia)
}

/** Dia útil = segunda a sexta. Feriados da B3 entram com o calendário de pregão (Fase 3). */
export function eDiaUtil(data: string): boolean {
  const d = diaDaSemana(data)
  return d !== 0 && d !== 6
}

export function proximoDiaUtil(data: string): string {
  let d = somarDias(data, 1)
  while (!eDiaUtil(d)) d = somarDias(d, 1)
  return d
}

export function primeiroDiaUtilDoMes(mes: string): string {
  let d = inicioDoMes(mes)
  while (!eDiaUtil(d)) d = somarDias(d, 1)
  return d
}

export function ultimoDiaUtilDoMes(mes: string, feriados: string[] = []): string {
  let d = ultimoDiaDoMes(mes)
  while (!eDiaUtil(d) || feriados.includes(d)) d = somarDias(d, -1)
  return d
}
