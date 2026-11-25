import { useId, useState } from 'react'
import { formatarCentavos, paraCentavos } from '../lib/calculos/dinheiro'
import type { Categoria } from '../lib/tipos'
import './componentes.css'

function textoInicial(centavos: number | null): string {
  if (centavos === null || centavos === 0) return ''
  return formatarCentavos(centavos).replace('R$ ', '')
}

/** Input de dinheiro: teclado numérico no celular, devolve centavos inteiros (ou null se inválido). */
export function CampoValor({
  rotulo,
  valorCentavos,
  aoMudar,
  grande = false,
  autoFocus = false,
}: {
  rotulo: string
  valorCentavos: number | null
  aoMudar: (centavos: number | null) => void
  grande?: boolean
  autoFocus?: boolean
}) {
  const id = useId()
  const [texto, setTexto] = useState(() => textoInicial(valorCentavos))
  const invalido = texto !== '' && paraCentavos(texto) === null
  return (
    <div className={`campo ${grande ? 'campo-valor' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        value={texto}
        autoFocus={autoFocus}
        aria-invalid={invalido}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, '')
          setTexto(t)
          aoMudar(t === '' ? null : paraCentavos(t))
        }}
      />
      {invalido && <p className="pequeno bad">Use o formato 1.234,56.</p>}
    </div>
  )
}

/** Categorias com as mais usadas primeiro. */
export function SeletorCategoria({
  categorias,
  maisUsadas,
  selecionada,
  aoEscolher,
}: {
  categorias: Categoria[]
  maisUsadas: string[]
  selecionada: string
  aoEscolher: (id: string) => void
}) {
  const ordem = new Map(maisUsadas.map((id, i) => [id, i]))
  const ordenadas = [...categorias].filter((c) => c.ativa).sort((a, b) => (ordem.get(a.id) ?? 99) - (ordem.get(b.id) ?? 99) || a.ordem - b.ordem)
  return (
    <div className="campo">
      <span className="so-leitor">Categoria</span>
      <div className="seletor-categoria" role="group" aria-label="Categoria">
        {ordenadas.map((c) => (
          <button key={c.id} type="button" aria-pressed={selecionada === c.id} onClick={() => aoEscolher(c.id)}>
            {c.nome}
          </button>
        ))}
      </div>
    </div>
  )
}
