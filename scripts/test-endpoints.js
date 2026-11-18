#!/usr/bin/env node
/**
 * test-endpoints.js
 * Testa todos os endpoints da SEFIN Nacional com mTLS.
 *
 * Uso:
 *   node scripts/test-endpoints.js --cert /path/to/cert.pfx --pass SENHA [--chave CHAVE50DIGITOS]
 *
 * Ou via variáveis de ambiente:
 *   CERT_PATH=/path/cert.pfx CERT_PASS=senha CHAVE=50digitos node scripts/test-endpoints.js
 */
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => { const idx = args.indexOf(flag); return idx !== -1 ? args[idx + 1] : undefined; };

const CERT_PATH = getArg('--cert') || process.env.CERT_PATH;
const CERT_PASS = getArg('--pass') || process.env.CERT_PASS || '';
const CHAVE     = getArg('--chave') || process.env.CHAVE || '';

const BASE_URL_HOM = 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse';
const BASE_URL_PRD = 'https://sefin.nfse.gov.br/sefinnacional/nfse';
const BASE_URL = process.env.AMBIENTE === '1' ? BASE_URL_PRD : BASE_URL_HOM;

// ─── Cores terminal ──────────────────────────────────────────────────────────
const C = { reset:'\x1b[0m', bold:'\x1b[1m', green:'\x1b[32m', yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m', gray:'\x1b[90m' };
const ok   = (m) => console.log(`${C.green}  ✅ ${m}${C.reset}`);
const warn = (m) => console.log(`${C.yellow}  ⚠️  ${m}${C.reset}`);
const fail = (m) => console.log(`${C.red}  ❌ ${m}${C.reset}`);
const info = (m) => console.log(`${C.cyan}  ℹ  ${m}${C.reset}`);
const hr   = ()  => console.log(`${C.gray}  ${'─'.repeat(68)}${C.reset}`);

// ─── Carregar PFX → PEM via node-forge ───────────────────────────────────────
function loadCert(pfxPath, password) {
  if (!pfxPath || !fs.existsSync(pfxPath)) throw new Error(`PFX não encontrado: ${pfxPath}`);
  const forge = require(path.join(__dirname, '..', 'node_modules', 'node-forge'));
  const pfxBuf = fs.readFileSync(pfxPath);
  const pfxAsn1 = forge.asn1.fromDer(pfxBuf.toString('binary'));
  const pfxObj  = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
  let privateKeyPem = '', certificatePem = '', subject = '';
  for (const sc of pfxObj.safeContents) {
    for (const bag of sc.safeBags) {
      if (bag.type === forge.pki.oids.certBag && bag.cert) {
        certificatePem = forge.pki.certificateToPem(bag.cert);
        subject = bag.cert.subject.getField('CN')?.value || '';
      }
      if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag && bag.key)
        privateKeyPem = forge.pki.privateKeyToPem(bag.key);
    }
  }
  if (!privateKeyPem || !certificatePem) throw new Error('Não foi possível extrair chave/cert do PFX.');
  return { privateKeyPem, certificatePem, subject };
}

// ─── HTTP com mTLS ────────────────────────────────────────────────────────────
function request(urlStr, method, privateKeyPem, certificatePem, data, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const agent = new https.Agent({ cert: certificatePem, key: privateKeyPem, rejectUnauthorized: false, keepAlive: false });
    const url   = new URL(urlStr);
    const opts  = {
      hostname: url.hostname, port: url.port || 443, path: url.pathname + url.search, method, agent,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'nfse-test/1.0' },
      timeout: timeoutMs,
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let raw = '';
      res.setEncoding('utf-8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ statusCode: res.statusCode, body: parsed, rawBody: raw, error: null });
      });
    });
    req.on('error', (e) => resolve({ statusCode: 0, body: null, rawBody: '', error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, body: null, rawBody: '', error: 'TIMEOUT' }); });
    if (data) req.write(data);
    req.end();
  });
}

// ─── Imprimir resultado ───────────────────────────────────────────────────────
function printResult(label, method, url, res) {
  const sc = res.statusCode;
  console.log(`\n${C.bold}${C.cyan}[${label}]${C.reset} ${method} ${url}`);
  if (res.error) { fail(`Erro de conexão: ${res.error}`); return; }
  const scColor = sc >= 200 && sc < 300 ? C.green : sc === 405 ? C.red : C.yellow;
  console.log(`  HTTP Status: ${scColor}${sc}${C.reset}`);
  const body = typeof res.body === 'object' ? JSON.stringify(res.body, null, 2) : String(res.body || '');
  if (body) console.log(`  Resposta:\n${C.gray}${body.substring(0, 600)}${body.length > 600 ? '\n  ...(truncado)' : ''}${C.reset}`);
  // Validação semântica
  if (sc === 405)                              fail(`Método ${method} rejeitado (405) — método HTTP errado no código!`);
  else if (sc === 401 || sc === 403)           fail(`Auth falhou (${sc}) — verificar certificado mTLS`);
  else if (sc === 0)                           warn('Sem resposta — verificar rede/VPN ou URL do ambiente');
  else if (sc >= 200 && sc < 300)             ok(`Endpoint respondeu ${sc} — método correto ✓`);
  else if (sc === 404)                        warn(`404 — endpoint existe mas recurso não encontrado (normal sem chave real)`);
  else if (sc === 400 || sc === 422)          warn(`${sc} — endpoint existe, payload inválido (normal em teste sem DPS/XML real)`);
  else                                         info(`Retornou ${sc}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗`);
  console.log(`║  SEFIN Nacional — Validação de Endpoints mTLS    ║`);
  console.log(`╚══════════════════════════════════════════════════╝${C.reset}\n`);

  if (!CERT_PATH) {
    fail('Certificado não informado. Use:');
    console.log(`  node scripts/test-endpoints.js --cert /path.pfx --pass SENHA [--chave CHAVE50]\n`);
    process.exit(1);
  }

  let cert;
  try {
    cert = loadCert(CERT_PATH, CERT_PASS);
    ok(`Certificado carregado: ${cert.subject}`);
  } catch (e) {
    fail(`Falha no certificado: ${e.message}`);
    process.exit(1);
  }

  const { privateKeyPem, certificatePem } = cert;
  const chave = (CHAVE || '').replace(/\D/g, '').padEnd(50, '0').substring(0, 50);

  console.log(`\n  Ambiente: ${BASE_URL.includes('restrita') ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'}`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Chave:    ${chave} ${CHAVE ? '(real)' : '(dummy — use --chave para testar com nota real)'}`);
  hr();

  // ── TESTE 1: POST /nfse — Emitir ────────────────────────────────────────
  console.log(`\n${C.bold}TESTE 1 — Emitir NFS-e → POST /nfse${C.reset}`);
  info('Payload mínimo para confirmar método aceito pelo endpoint...');
  const r1 = await request(BASE_URL, 'POST', privateKeyPem, certificatePem, JSON.stringify({ dpsXmlGZipB64: 'dGVzdGU=' }));
  printResult('Emitir: POST /nfse', 'POST', BASE_URL, r1);

  info('Confirmar que GET no /nfse retorna 405...');
  const r1g = await request(BASE_URL, 'GET', privateKeyPem, certificatePem, null);
  printResult('Emitir: GET /nfse (deve ser 405)', 'GET', BASE_URL, r1g);
  if (r1g.statusCode === 405) ok('Confirmado: GET em /nfse retorna 405 ✓');
  hr();

  // ── TESTE 2: GET /nfse/{chave} — Consultar ──────────────────────────────
  const consultaUrl = `${BASE_URL}/${chave}`;
  console.log(`\n${C.bold}TESTE 2 — Consultar NFS-e → GET /nfse/{chave}${C.reset}`);
  const r2 = await request(consultaUrl, 'GET', privateKeyPem, certificatePem, null);
  printResult('Consultar: GET /nfse/{chave}', 'GET', consultaUrl, r2);

  info('Confirmar que POST em /nfse/{chave} retorna 405...');
  const r2p = await request(consultaUrl, 'POST', privateKeyPem, certificatePem, '{}');
  printResult('Consultar: POST /nfse/{chave} (deve ser 405)', 'POST', consultaUrl, r2p);
  if (r2p.statusCode === 405) ok('Confirmado: POST em /nfse/{chave} retorna 405 ✓');
  hr();

  // ── TESTE 3: POST /nfse/{chave}/eventos — Cancelar ──────────────────────
  const eventosUrl = `${BASE_URL}/${chave}/eventos`;
  console.log(`\n${C.bold}TESTE 3 — Cancelar NFS-e → POST /nfse/{chave}/eventos${C.reset}`);
  const r3 = await request(eventosUrl, 'POST', privateKeyPem, certificatePem,
    JSON.stringify({ pedidoRegistroEventoXmlGZipB64: 'dGVzdGU=', eventoXmlGZipB64: 'dGVzdGU=' }));
  printResult('Cancelar: POST /nfse/{chave}/eventos', 'POST', eventosUrl, r3);
  hr();

  // ── TESTE 4: GET /nfse/{chave}/eventos — Consultar Eventos ──────────────
  console.log(`\n${C.bold}TESTE 4 — Consultar Eventos → GET /nfse/{chave}/eventos${C.reset}`);
  const r4 = await request(eventosUrl, 'GET', privateKeyPem, certificatePem, null);
  printResult('Eventos: GET /nfse/{chave}/eventos', 'GET', eventosUrl, r4);
  hr();

  // ── RESUMO ───────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}RESUMO — Mapeamento HTTP esperado:${C.reset}`);
  console.log(`  Operação n8n           Método  Endpoint`);
  console.log(`  ─────────────────────  ──────  ─────────────────────────────`);
  console.log(`  Emitir NFS-e           POST    /nfse`);
  console.log(`  Consultar por Chave    GET     /nfse/{chave}`);
  console.log(`  Cancelar NFS-e         POST    /nfse/{chave}/eventos`);
  console.log(`  Consultar Eventos      GET     /nfse/{chave}/eventos`);
  console.log(`  Gerar DANFSE (PDF)     —       (local, sem chamada SEFIN)\n`);

  console.log(`${C.bold}Legenda:${C.reset}`);
  console.log(`  ${C.green}✅ 2xx${C.reset}  Endpoint respondeu (método correto)`);
  console.log(`  ${C.yellow}⚠️  4xx${C.reset}  Endpoint existe, dados inválidos (normal sem DPS/XML real)`);
  console.log(`  ${C.red}❌ 405${C.reset}  Método HTTP errado — bug no código!`);
  console.log(`  ${C.red}❌ 0  ${C.reset}  Sem conexão / timeout / cert inválido\n`);
}

main().catch((e) => { fail(`Fatal: ${e.message}`); process.exit(1); });
