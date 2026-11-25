# NavegacaoInferior

Barra fixa no rodapé do celular com Hoje, Gastos, Trade, Plano e Mais, e o botão "+" redondo no centro para lançar um gasto.

## O que o consumidor fornece
- A rota ativa (`aria-current="page"` no item).
- O destino do "+": a tela de novo lançamento.

## Regras
- Ordem fixa: Hoje, Gastos, +, Trade, Plano, Mais (6 colunas iguais).
- Fundo `superficie`, contorno `traco-grosso` em `contorno`, cantos superiores `raio-g`. Padding inferior soma `env(safe-area-inset-bottom)`.
- Item ativo: fundo `co-claro`, ícone `co`, texto `tinta`. O estado ativo é dado pelo fundo e pelo ícone, não só pela cor do texto.
- Itens com altura mínima de 56px. O "+" tem `alvo-mais` (64px), sombra `sombra-g`, e sobe 30px acima da barra.
- O "+" é um `<button>` com `aria-label="Lançar gasto"`.
- Desktop (900px ou mais): os mesmos itens viram barra lateral, como hoje em `src/estilos/layout.css`; o "+" vira um botão primário no fim da lista.

## Movimento
- Pressionar o "+": afunda 5px na própria sombra.
- Depois que o gasto é salvo (não no toque, e sim no sucesso), o "+" quica duas vezes com `curva-mola` e o aviso de sucesso entra com uma mola curta. O quique confirma que o lançamento foi gravado.
- Com `prefers-reduced-motion: reduce`, sem quique; o aviso de sucesso aparece direto.

## Não faça
- Não quique o "+" em loop para chamar atenção.
- O aviso de sucesso é factual ("Gasto de R$ 18,50 lançado em Alimentação."), sem comemoração.
