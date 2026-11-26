import { useEffect, useRef, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import '../estilos/layout.css'
import { aoSalvarGasto } from './avisoGasto'
import { Sincronizacao } from './Sincronizacao'

const classe = ({ isActive }: { isActive: boolean }) => (isActive ? 'ativo' : '')

/** Ícones de traço, 24px, em currentColor (docs/02_DESIGN_SYSTEM/cartoon, Iconografia). Decorativos: o texto carrega o nome. */
function Icone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

/** Celular: Hoje, Gastos, +, Trade, Plano, Mais (docs/02_DESIGN_SYSTEM). Desktop: barra lateral com os mesmos itens. */
export function Layout() {
  const mais = useRef<HTMLAnchorElement>(null)

  // Gasto salvo: o + quica. Some a classe ao fim para poder quicar de novo no próximo.
  useEffect(
    () =>
      aoSalvarGasto(() => {
        const botao = mais.current
        if (!botao) return
        botao.classList.remove('quica')
        void botao.offsetWidth
        botao.classList.add('quica')
      }),
    [],
  )

  return (
    <div className="app">
      <nav className="navegacao" aria-label="Principal">
        <span className="marca">Rota do Milhão</span>
        <NavLink to="/" end className={classe}>
          <Icone>
            <path d="M4 11 L12 4 L20 11 V20 H4 Z" />
            <path d="M10 20 V14 H14 V20" />
          </Icone>
          Hoje
        </NavLink>
        <NavLink to="/gastos" end className={classe}>
          <Icone>
            <path d="M6 3 H18 V21 L15 19 L12 21 L9 19 L6 21 Z" />
            <path d="M9 8 H15 M9 12 H15" />
          </Icone>
          Gastos
        </NavLink>
        <NavLink
          ref={mais}
          to="/gastos/novo"
          className={({ isActive }) => `mais-botao ${isActive ? 'ativo' : ''}`}
          aria-label="Novo gasto"
          onAnimationEnd={(e) => e.currentTarget.classList.remove('quica')}
        >
          <svg viewBox="0 0 30 30" aria-hidden="true">
            <path d="M15 5 V25 M5 15 H25" />
          </svg>
          <span className="texto-mais" aria-hidden="true">
            Novo gasto
          </span>
        </NavLink>
        <NavLink to="/trade" className={classe}>
          <Icone>
            <path d="M7 4 V20 M17 4 V20" />
            <rect x="4.5" y="8" width="5" height="7" rx="1.5" />
            <rect x="14.5" y="6" width="5" height="9" rx="1.5" />
          </Icone>
          Trade
        </NavLink>
        <NavLink to="/plano" className={classe}>
          <Icone>
            <path d="M6 21 V4" />
            <path d="M6 4 H18 L15 8 L18 12 H6" />
          </Icone>
          Plano
        </NavLink>
        <NavLink to="/mais" className={classe}>
          <Icone>
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </Icone>
          Mais
        </NavLink>
      </nav>
      <main className="conteudo">
        <Sincronizacao />
        <Outlet />
      </main>
    </div>
  )
}

export function Mais() {
  const itens = [
    { para: '/noticias', nome: 'Notícias', texto: 'Revisão pré-pregão, watchlist e uso da IA' },
    { para: '/patrimonio', nome: 'Patrimônio', texto: 'Ativos, reserva e movimentos' },
    { para: '/orcamento', nome: 'Orçamento', texto: 'Categorias, valores e renda prevista' },
    { para: '/fechamento', nome: 'Fechamento', texto: 'Fechar o mês e recalcular o plano' },
    { para: '/configuracoes', nome: 'Configurações', texto: 'Perfil, premissas e exportação CSV' },
  ]
  return (
    <>
      <h1>Mais</h1>
      <div className="grade">
        {itens.map((i) => (
          <NavLink key={i.para} to={i.para} className="painel">
            <h2>{i.nome}</h2>
            <p className="mut pequeno">{i.texto}</p>
          </NavLink>
        ))}
      </div>
    </>
  )
}
