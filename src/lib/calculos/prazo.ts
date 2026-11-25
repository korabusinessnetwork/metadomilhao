export function formatarPrazo(meses: number | null): string {
  if (meses === null) return 'fora do alcance'
  if (meses <= 0) return 'meta atingida'
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  const parteAnos = anos === 0 ? '' : `${anos} ${anos === 1 ? 'ano' : 'anos'}`
  const parteMeses = resto === 0 ? '' : `${resto} ${resto === 1 ? 'mês' : 'meses'}`
  return [parteAnos, parteMeses].filter(Boolean).join(' e ')
}
