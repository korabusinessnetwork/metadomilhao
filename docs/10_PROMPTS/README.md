# Prompts, Rota do Milhão

## Revisão de notícias pré-pregão (ADR-004)

Versão: v1 · Modelo: `MODELO_REVISAO` · Ferramenta: busca na web (máximo `MAX_BUSCAS`)

### Sistema
```
Você prepara uma revisão de notícias para um operador pessoa física de day trade na B3, antes da abertura do pregão.
Regras:
- Seja informativo. Nunca recomende comprar, vender ou manter. Não sugira preço de entrada, stop ou alvo.
- Use só notícias das últimas 24 horas, ou eventos agendados para hoje. Cite a fonte de cada item.
- Se não encontrar nada relevante para um ativo, diga isso. Não invente.
- Separe fato de interpretação. Marque interpretações como "possível impacto".
- Responda apenas com JSON válido no schema fornecido, em português do Brasil.
```

### Usuário (montado pela função)
```
Data: {{data}} (America/Sao_Paulo)
Ativos: {{lista_watchlist}}  // ex.: PETR4 (ações), VALE3 (ações), WIN (mini-índice)
Inclua também: agenda macro do dia no Brasil e nos EUA que pode mexer com o Ibovespa, o dólar e os ativos acima.
```

### Schema de saída
```json
{
  "data": "AAAA-MM-DD",
  "agenda": [{ "hora": "HH:MM", "evento": "", "pais": "BR|US|outro", "relevancia": "alta|media|baixa" }],
  "ativos": [{
    "ativo": "",
    "noticias": [{ "titulo": "", "resumo": "", "fonte": "", "url": "" }],
    "possivel_impacto": "",
    "riscos_do_dia": [""],
    "sem_novidades": false
  }],
  "contexto_geral": ""
}
```

### Validação
- JSON inválido: uma nova tentativa com o erro de validação; se falhar de novo, salva status `erro`.
- Qualquer item sem `fonte` é descartado.
- Texto que contenha recomendação explícita ("compre", "venda") reprova a resposta.

## Histórico de versões
| Versão | Data | Mudança |
|---|---|---|
| v1 | 2026-11-25 | Primeira versão |
