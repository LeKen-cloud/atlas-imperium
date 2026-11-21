// Local open-weight model client. Default: Ollama + Qwen3 8B. Also speaks the OpenAI-compatible
// API exposed by llama.cpp server, vLLM and LM Studio. Never required: callers fall back to rules.

export interface AIConfig { enabled: boolean; kind: 'ollama' | 'openai'; endpoint: string; model: string; avKey?: string }
const KEY = 'atlas.ai.config';
export const DEFAULT_AI: AIConfig = { enabled: true, kind: 'ollama', endpoint: 'http://localhost:11434', model: 'qwen3:8b' };
export function loadAIConfig(): AIConfig {
  try { const s = localStorage.getItem(KEY); if (s) return { ...DEFAULT_AI, ...JSON.parse(s) }; } catch { /* storage unavailable */ }
  return { ...DEFAULT_AI };
}
export function saveAIConfig(c: AIConfig) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ } }

let status: 'unknown' | 'online' | 'offline' = 'unknown';
let lastCheck = 0;
export const aiStatus = () => status;

export async function ping(cfg: AIConfig): Promise<boolean> {
  if (!cfg.enabled) { status = 'offline'; return false; }
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 2500);
    const url = cfg.kind === 'ollama' ? cfg.endpoint.replace(/\/$/, '') + '/api/tags' : cfg.endpoint.replace(/\/$/, '') + '/v1/models';
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(to);
    status = r.ok ? 'online' : 'offline';
  } catch { status = 'offline'; }
  lastCheck = Date.now();
  return status === 'online';
}

// Ask for a JSON object that matches `schema`. Returns null on any failure (callers then use rules).
export async function askJSON<T>(cfg: AIConfig, system: string, user: string, schema: object, timeoutMs = 60000): Promise<T | null> {
  if (!cfg.enabled) return null;
  if (status === 'offline' && Date.now() - lastCheck < 30000) return null;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let text = '';
    if (cfg.kind === 'ollama') {
      const r = await fetch(cfg.endpoint.replace(/\/$/, '') + '/api/chat', {
        method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cfg.model, stream: false, think: false, format: schema, options: { temperature: 0.4, num_ctx: 8192 }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json(); text = j.message?.content || '';
    } else {
      const r = await fetch(cfg.endpoint.replace(/\/$/, '') + '/v1/chat/completions', {
        method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cfg.model, temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system + '\nReply with JSON only matching this schema: ' + JSON.stringify(schema) }, { role: 'user', content: user }] }),
      });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json(); text = j.choices?.[0]?.message?.content || '';
    }
    status = 'online'; lastCheck = Date.now();
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    status = 'offline'; lastCheck = Date.now();
    return null;
  } finally { clearTimeout(to); }
}
