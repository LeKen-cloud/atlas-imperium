// Shared colour language: every interface and news category has its own hue.
export const PANEL_COLORS: Record<string, string> = {
  government: '#f5b942', internal: '#a78bfa', economy: '#34d399', markets: '#fbbf24', corporate: '#22d3ee', trade: '#2dd4bf', diplomacy: '#60a5fa', international: '#818cf8',
  military: '#f87171', society: '#f472b6', news: '#fb923c', timeline: '#c084fc', intel: '#38bdf8', realworld: '#4ade80', editor: '#facc15', settings: '#94a3b8', compare: '#e879f9',
};
export const CAT_COLORS: Record<string, string> = {
  economy: '#34d399', finance: '#fbbf24', politics: '#a78bfa', diplomacy: '#60a5fa', conflict: '#f87171', trade: '#2dd4bf', business: '#22d3ee', social: '#f472b6',
  disaster: '#fb923c', science: '#38bdf8', health: '#4ade80', borders: '#facc15', meta: '#94a3b8',
};
export const CAT_ICONS: Record<string, string> = {
  economy: '◔', finance: '↗', politics: '⚖', diplomacy: '✉', conflict: '⚔', trade: '⇄', business: '▦', social: '✊', disaster: '⚠', science: '⚛', health: '✚', borders: '⛿', meta: '◈',
};
