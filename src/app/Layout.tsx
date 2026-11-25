import { NavLink, Outlet } from 'react-router-dom'
import '../estilos/layout.css'

const classe = ({ isActive }: { isActive: boolean }) => (isActive ? 'ativo' : '')

/** Celular: Hoje, Gastos, +, Plano, Mais. Desktop: barra lateral com os mesmos itens. Trade entra na Fase 2. */
export function Layout() {
  return (
    <div className="app">
      <nav className="navegacao" aria-label="Principal">
        <span className="marca">Rota do Milhão</span>
        <NavLink to="/" end className={classe}>
          Hoje
        </NavLink>
        <NavLink to="/gastos" end className={classe}>
          Gastos
        </NavLink>
        <NavLink to="/gastos/novo" className={({ isActive }) => `mais-botao ${isActive ? 'ativo' : ''}`} aria-label="Novo gasto">
          <span aria-hidden="true">+</span>
          <span className="so-leitor">Novo gasto</span>
        </NavLink>
        <NavLink to="/plano" className={classe}>
          Plano
        </NavLink>
        <NavLink to="/mais" className={classe}>
          Mais
        </NavLink>
      </nav>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  )
}

export function Mais() {
  const itens = [
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
          <NavLink key={i.para} to={i.para} className="painel" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h2 style={{ color: 'var(--co)' }}>{i.nome}</h2>
            <p className="mut pequeno">{i.texto}</p>
          </NavLink>
        ))}
      </div>
    </>
  )
}
