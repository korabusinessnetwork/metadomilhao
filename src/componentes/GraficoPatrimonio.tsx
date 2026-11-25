import { formatarCentavos } from '../lib/calculos/dinheiro'
import './componentes.css'

export interface PontoGrafico {
  rotulo: string
  centavos: number
}

const LARGURA = 640
const ALTURA = 240
const MARGEM = { esq: 8, dir: 8, topo: 16, base: 28 }

/** Linha cheia = realizado. Linha tracejada em --warn = projeção (docs/02_DESIGN_SYSTEM). */
export function GraficoPatrimonio({ real, projetado }: { real: PontoGrafico[]; projetado: PontoGrafico[] }) {
  const todos = [...real, ...projetado]
  if (todos.length < 2) return null
  const rotulos = [...new Set(todos.map((p) => p.rotulo))]
  const maximo = Math.max(...todos.map((p) => p.centavos), 1)
  const x = (rotulo: string) => MARGEM.esq + (rotulos.indexOf(rotulo) / Math.max(1, rotulos.length - 1)) * (LARGURA - MARGEM.esq - MARGEM.dir)
  const y = (c: number) => MARGEM.topo + (1 - c / maximo) * (ALTURA - MARGEM.topo - MARGEM.base)
  const caminho = (pontos: PontoGrafico[]) => pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.rotulo).toFixed(1)},${y(p.centavos).toFixed(1)}`).join(' ')
  const primeiro = rotulos[0]!
  const ultimo = rotulos[rotulos.length - 1]!

  return (
    <figure style={{ margin: 0 }}>
      <svg className="grafico" viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-label={`Patrimônio de ${primeiro} a ${ultimo}, máximo ${formatarCentavos(maximo)}`}>
        <line className="eixo" x1={MARGEM.esq} x2={LARGURA - MARGEM.dir} y1={ALTURA - MARGEM.base} y2={ALTURA - MARGEM.base} />
        {real.length > 1 && <path className="real" d={caminho(real)} />}
        {projetado.length > 1 && <path className="projetado" d={caminho(projetado)} />}
        {real.length === 1 && <circle cx={x(real[0]!.rotulo)} cy={y(real[0]!.centavos)} r={4} fill="var(--co)" />}
        <text x={MARGEM.esq} y={ALTURA - 8}>{primeiro}</text>
        <text x={LARGURA - MARGEM.dir} y={ALTURA - 8} textAnchor="end">{ultimo}</text>
        <text x={MARGEM.esq} y={12}>{formatarCentavos(maximo)}</text>
      </svg>
      <figcaption className="legenda-grafico">
        <span><span className="traco" />Realizado</span>
        <span><span className="traco projetado" />Projeção</span>
      </figcaption>
    </figure>
  )
}
