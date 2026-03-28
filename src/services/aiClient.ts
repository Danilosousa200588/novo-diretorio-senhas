/**
 * /src/services/aiClient.ts
 *
 * Funções frontend para consumir o backend de IA (/api/ai).
 * A chave Groq NUNCA passa pelo frontend — apenas o backend a conhece.
 * A senha SEMPRE é mascarada antes de qualquer envio.
 */

// ─── Tipos de resposta ─────────────────────────────────────────────────────

export interface AnaliseSegurancaSenha {
  nivel: 'fraca' | 'média' | 'forte';
  explicacao: string;
  sugestao: string;
  senhaMascarada: string; // apenas para exibição
}

export interface SenhaGerada {
  senha: string;
  descricao: string;
}

export interface AnaliseGeral {
  qtdFracas: number;
  padroesInseguros: string[];
  recomendacoes: string[];
  nivelGeral: 'precisa melhorar' | 'razoável' | 'bom' | 'excelente';
}

// ─── Utilitário local: mascara senha ──────────────────────────────────────

/**
 * Mascara a senha ANTES de qualquer envio ao servidor.
 * Ex: "MinhaS3nha!" → "Mi*********"
 * Nunca enviamos a senha completa.
 */
function mascarar(senha: string): string {
  if (!senha || senha.length <= 2) return '**';
  return senha.slice(0, 2) + '*'.repeat(senha.length - 2);
}

// ─── Chamada genérica ao backend ──────────────────────────────────────────

async function chamarAPI<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json.success) throw new Error(json.error || 'Resposta inesperada do servidor');

  return json.data as T;
}

// ─── 1. Analisar força de uma senha ──────────────────────────────────────

/**
 * Analisa a força de uma senha usando IA.
 * A senha é MASCARADA localmente antes do envio — o servidor recebe apenas
 * características estatísticas (comprimento, tipos de caractere, etc).
 *
 * @param senha - Senha original (visível apenas localmente)
 * @returns Nível (fraca/média/forte), explicação e sugestão
 */
export async function chamarAnaliseSenha(senha: string): Promise<AnaliseSegurancaSenha> {
  if (!senha) throw new Error('Senha não pode ser vazia.');

  const data = await chamarAPI<Omit<AnaliseSegurancaSenha, 'senhaMascarada'>>('analisarSenha', {
    senha, // o servidor também mascara internamente antes de enviar à Groq
  });

  return {
    ...data,
    senhaMascarada: mascarar(senha),
  };
}

// ─── 2. Gerar Uma Senha Forte ─────────────────────────────────────────────

/**
 * Solicita à IA que gere uma senha forte e única.
 * Não há dados sensíveis no envio.
 *
 * @returns Senha gerada e descrição do padrão
 */
export async function chamarGerarSenha(): Promise<SenhaGerada> {
  return chamarAPI<SenhaGerada>('gerarSenha', {});
}

// ─── 3. Análise Geral de Segurança ───────────────────────────────────────

import type { PasswordEntry } from '@/types/password';
import { getPasswordStrength } from '@/lib/passwordUtils';

// ─── Tipos extras ──────────────────────────────────────────────────────────

export interface AnaliseEntrada {
  nome: string;
  descricao: string;
  nivel: 'fraca' | 'média' | 'forte';
  explicacao: string;
  sugestao: string;
}

export interface AnalisePorEntrada {
  entradas: AnaliseEntrada[];
  resumo: string;
}

/**
 * Analisa a segurança geral do cofre de senhas.
 * Envia apenas ESTATÍSTICAS AGREGADAS — nunca conteúdo real das senhas.
 *
 * @param entries - Lista de entradas do cofre
 * @returns Relatório geral com padrões inseguros e recomendações
 */
export async function chamarAnaliseGeral(entries: PasswordEntry[]): Promise<AnaliseGeral> {
  if (entries.length === 0) throw new Error('Nenhuma senha para analisar.');

  // Coleta apenas métricas — nunca o conteúdo das senhas
  const forças = entries.map(e => getPasswordStrength(e.password).score);
  const estatisticas = {
    total: entries.length,
    fracas: forças.filter(s => s <= 1).length,
    medias: forças.filter(s => s === 2 || s === 3).length,
    fortes: forças.filter(s => s >= 4).length,
    semSimbolo: entries.filter(e => !/[^A-Za-z0-9]/.test(e.password)).length,
    comprimentoMedio: Math.round(
      entries.reduce((acc, e) => acc + e.password.length, 0) / entries.length
    ),
  };

  return chamarAPI<AnaliseGeral>('analisarSegurancaGeral', { estatisticas });
}

// ─── 4. Análise por entrada (nome, descrição, metadados — sem a senha) ────

/**
 * Analisa cada senha individualmente com base em metadados.
 * A senha NUNCA é enviada ao servidor — apenas características técnicas.
 *
 * @param entries - Lista de entradas do cofre
 * @returns Análise individual de cada conta
 */
export async function chamarAnalisePorEntrada(entries: PasswordEntry[]): Promise<AnalisePorEntrada> {
  if (entries.length === 0) throw new Error('Nenhuma senha para analisar.');

  const entradas = entries.map(e => ({
    nome: e.name,
    descricao: e.description || '',
    caracteristicas: {
      comprimento: e.password.length,
      temMaiuscula: /[A-Z]/.test(e.password),
      temMinuscula: /[a-z]/.test(e.password),
      temNumero: /\d/.test(e.password),
      temSimbolo: /[^A-Za-z0-9]/.test(e.password),
      padroesComuns: /^(123|abc|password|senha|qwerty)/i.test(e.password),
    },
  }));

  return chamarAPI<AnalisePorEntrada>('analisarPorEntrada', { entradas });
}
