// Cria o usuário de teste no Supabase LOCAL (cadastro público fica desligado).
// Uso: SUPABASE_URL=... SERVICE_ROLE_KEY=... EMAIL=... SENHA=... node scripts/criar-usuario-local.mjs
// Nunca rode isto contra o projeto de produção: lá o dono cria a própria conta pelo painel do Supabase.
const { SUPABASE_URL, SERVICE_ROLE_KEY, EMAIL, SENHA } = process.env
if (!SUPABASE_URL?.startsWith('http://127.0.0.1')) throw new Error('Só para o Supabase local (127.0.0.1).')
const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: SENHA, email_confirm: true }),
})
console.log(r.status === 200 ? 'usuário criado' : `falhou: ${r.status} ${await r.text()}`)
