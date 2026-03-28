/**
 * /server/index.js
 * Backend seguro — expõe POST /api/ai para o frontend.
 * A chave Groq (GROQ_API_KEY) NUNCA é enviada ao frontend.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializa o cliente Groq com a chave do .env
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Modelo a usar
const MODEL = 'llama-3.1-8b-instant';

// ─── Middlewares ──────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  'https://qiilerbewoloaijqloem.supabase.co',
  process.env.PRODUCTION_URL, // Set PRODUCTION_URL in .env when deploying
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin not allowed → ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json());

// ─── Utilitários ─────────────────────────────────────────────────────────────

/**
 * Mascara a senha mantendo os 2 primeiros caracteres visíveis.
 * Ex: "minhaSenha123" → "mi***********"
 * NUNCA enviamos a senha completa à IA.
 */
function mascaraSenha(senha) {
  if (!senha || senha.length <= 2) return '**';
  return senha.slice(0, 2) + '*'.repeat(senha.length - 2);
}

/**
 * Analisa características básicas da senha LOCALMENTE (sem enviar à IA).
 * Isso garante que não vaze dados sobre o conteúdo real da senha.
 */
function analisarCaracteristicas(senha) {
  return {
    comprimento: senha.length,
    temMaiuscula: /[A-Z]/.test(senha),
    temMinuscula: /[a-z]/.test(senha),
    temNumero: /\d/.test(senha),
    temSimbolo: /[^A-Za-z0-9]/.test(senha),
    padroesComuns: /^(123|abc|password|senha|qwerty)/i.test(senha),
  };
}

// ─── Endpoint principal ───────────────────────────────────────────────────────

/**
 * POST /api/ai
 *
 * Body: { action: string, payload: object }
 *
 * Ações suportadas:
 *   - analisarSenha   → analisa força da senha (senha MASCARADA)
 *   - gerarSenha      → gera uma senha forte via Groq
 *   - analisarSegurancaGeral → analisa lista de estatísticas de senhas
 */
app.post('/api/ai', async (req, res) => {
  const { action, payload } = req.body;

  try {
    let prompt = '';
    let systemPrompt = 'Você é um especialista em segurança de senhas. Responda SEMPRE em JSON válido, sem markdown ou texto extra.';

    // ── 1. Analisar uma senha ─────────────────────────────────────────────────
    if (action === 'analisarSenha') {
      const { senha } = payload;

      if (!senha) return res.status(400).json({ error: 'Campo "senha" é obrigatório.' });

      // Mascara a senha antes de qualquer coisa!
      const senhaMascarada = mascaraSenha(senha);
      // Extrai só as características (não o conteúdo real)
      const caracteristicas = analisarCaracteristicas(senha);

      prompt = `Analise a segurança de uma senha com as seguintes características (a senha real foi ocultada — você recebe apenas metadados):
- Forma mascarada: "${senhaMascarada}"
- Comprimento: ${caracteristicas.comprimento} caracteres
- Tem letras maiúsculas: ${caracteristicas.temMaiuscula}
- Tem letras minúsculas: ${caracteristicas.temMinuscula}
- Tem números: ${caracteristicas.temNumero}
- Tem símbolos: ${caracteristicas.temSimbolo}
- Possui padrões comuns/fracos: ${caracteristicas.padroesComuns}

Retorne um JSON com exatamente esta estrutura:
{
  "nivel": "fraca" | "média" | "forte",
  "explicacao": "explicação curta em português de por que a senha é assim",
  "sugestao": "sugestão específica e prática para melhorar"
}`;

    // ── 2. Gerar senha forte ──────────────────────────────────────────────────
    } else if (action === 'gerarSenha') {
      prompt = `Gere uma senha forte e segura com as seguintes regras:
- Mínimo 16 caracteres
- Inclua letras maiúsculas, minúsculas, números e símbolos especiais
- Evite sequências óbvias (123, abc, etc)
- Deve ser memorável mas complexa

Retorne um JSON com exatamente esta estrutura:
{
  "senha": "a_senha_gerada_aqui",
  "descricao": "breve explicação do padrão usado (em português)"
}`;

    // ── 3. Análise geral de segurança ─────────────────────────────────────────
    } else if (action === 'analisarSegurancaGeral') {
      const { estatisticas } = payload;
      // estatisticas = { total, fracas, medias, fortes, semSimbolo, comprimentoMedio }

      if (!estatisticas) return res.status(400).json({ error: 'Campo "estatisticas" é obrigatório.' });

      prompt = `Analise as estatísticas de segurança de um cofre de senhas (sem dados reais — apenas métricas agregadas):
- Total de senhas: ${estatisticas.total}
- Senhas fracas: ${estatisticas.fracas}
- Senhas médias: ${estatisticas.medias}
- Senhas fortes: ${estatisticas.fortes}
- Senhas sem símbolo especial: ${estatisticas.semSimbolo}
- Comprimento médio: ${estatisticas.comprimentoMedio} caracteres

Retorne um JSON com exatamente esta estrutura:
{
  "qtdFracas": ${estatisticas.fracas},
  "padroesInseguros": ["lista de padrões inseguros identificados pelas métricas"],
  "recomendacoes": ["lista de 3 a 5 recomendações práticas em português"],
  "nivelGeral": "precisa melhorar" | "razoável" | "bom" | "excelente"
}`;

    // ── 4. Análise por entrada (nome + metadados, SEM a senha) ────────────────
    } else if (action === 'analisarPorEntrada') {
      const { entradas } = payload;

      if (!entradas || !Array.isArray(entradas) || entradas.length === 0)
        return res.status(400).json({ error: 'Campo "entradas" é obrigatório e deve ser uma lista.' });

      const listaFormatada = entradas.map((e, i) => {
        const c = e.caracteristicas;
        return `Entrada ${i + 1}:
  Nome/Conta: "${e.nome}"
  Descrição: "${e.descricao || 'Sem descrição'}"
  Comprimento da senha: ${c.comprimento} caracteres
  Tem maiúsculas: ${c.temMaiuscula}
  Tem minúsculas: ${c.temMinuscula}
  Tem números: ${c.temNumero}
  Tem símbolos: ${c.temSimbolo}
  Padrão comum/fraco: ${c.padroesComuns}`;
      }).join('\n\n');

      prompt = `Você é um especialista em cibersegurança. Analise as seguintes contas de um cofre de senhas. As senhas reais NÃO foram fornecidas — apenas metadados. Seja específico para cada conta, mencione o Nome/Conta e a Descrição quando houver. NUNCA mencione nem repita qualquer senha.

${listaFormatada}

Retorne um JSON com exatamente esta estrutura:
{
  "entradas": [
    {
      "nome": "nome da conta",
      "descricao": "descrição ou vazio",
      "nivel": "fraca" | "média" | "forte",
      "explicacao": "análise específica em 1-2 frases em português",
      "sugestao": "sugestão prática de melhoria em 1 frase"
    }
  ],
  "resumo": "resumo geral do cofre em 2 frases"
}`;

    } else {
      return res.status(400).json({ error: `Ação desconhecida: "${action}"` });
    }

    // ── Chamada à API Groq ────────────────────────────────────────────────────
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });

    const rawContent = completion.choices[0]?.message?.content || '{}';

    // Parse seguro do JSON retornado pela IA
    let resultado;
    try {
      resultado = JSON.parse(rawContent);
    } catch {
      resultado = { raw: rawContent };
    }

    return res.json({ success: true, data: resultado });

  } catch (error) {
    console.error('[AI Backend] Erro:', error?.message || error);
    return res.status(500).json({
      error: 'Erro ao processar requisição de IA.',
      detalhe: error?.message || 'Erro desconhecido',
    });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: MODEL });
});

// ─── Start condicional (Local Dev vs Vercel Serverless) ──────────────────────
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🤖 AI Backend rodando em http://localhost:${PORT}`);
    console.log(`   Endpoint: POST http://localhost:${PORT}/api/ai`);
  });
}

// ─── Export para Vercel Serverless ───────────────────────────────────────────
export default app;
