// Gera o código TOTP de um segredo base32. Só para testar o fluxo de MFA no ambiente local.
// Uso: node scripts/totp-local.mjs SEGREDO
import { createHmac } from 'node:crypto'

const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const segredo = (process.argv[2] ?? '').replace(/=+$/, '').toUpperCase()
let bits = ''
for (const c of segredo) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0')
const chave = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
const contador = Buffer.alloc(8)
contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
const hmac = createHmac('sha1', chave).update(contador).digest()
const deslocamento = hmac[hmac.length - 1] & 0xf
const codigo = (hmac.readUInt32BE(deslocamento) & 0x7fffffff) % 1_000_000
console.log(String(codigo).padStart(6, '0'))
