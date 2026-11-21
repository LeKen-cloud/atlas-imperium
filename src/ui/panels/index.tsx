import type { Panel } from '../common';
import { useGame } from '../common';
import { GovernmentPanel } from './Government';
import { InternalPanel } from './Internal';
import { EconomyPanel } from './Economy';
import { MarketsPanel } from './Markets';
import { CorporatePanel } from './Corporate';
import { TradePanel } from './Trade';
import { DiplomacyPanel } from './Diplomacy';
import { InternationalPanel } from './International';
import { MilitaryPanel } from './Military';
import { SocietyPanel } from './Society';
import { NewsPanel, TimelinePanel } from './News';
import { IntelPanel } from './Intel';
import { EditorPanel } from './Editor';
import { SettingsPanel } from './Settings';
import { RealWorldPanel } from './RealWorld';
import { ComparePanel } from './Compare';

export { PANEL_COLORS } from '../theme';
export const NAV: [Panel, string][] = [
  ['government', '⌂'], ['internal', '⚖'], ['economy', '◔'], ['markets', '↗'], ['corporate', '▦'], ['trade', '⇄'], ['diplomacy', '✉'], ['international', '◎'],
  ['military', '⛨'], ['society', '☰'], ['news', '✦'], ['timeline', '⌛'], ['intel', '⌕'], ['realworld', '◉'], ['editor', '✎'], ['settings', '⚙'],
];

// The country a national panel shows: the selected country, else the player's.
export function useFocus() { const g = useGame(); const iso = g.selected && g.w.countries[g.selected]?.alive ? g.selected : g.w.player; return { ...g, iso, mine: !!iso && iso === g.w.player }; }

export function PanelHost({ panel }: { panel: Panel }) {
  switch (panel) {
    case 'government': return <GovernmentPanel />;
    case 'internal': return <InternalPanel />;
    case 'economy': return <EconomyPanel />;
    case 'markets': return <MarketsPanel />;
    case 'corporate': return <CorporatePanel />;
    case 'trade': return <TradePanel />;
    case 'diplomacy': return <DiplomacyPanel />;
    case 'international': return <InternationalPanel />;
    case 'military': return <MilitaryPanel />;
    case 'society': return <SocietyPanel />;
    case 'news': return <NewsPanel />;
    case 'timeline': return <TimelinePanel />;
    case 'intel': return <IntelPanel />;
    case 'editor': return <EditorPanel />;
    case 'settings': return <SettingsPanel />;
    case 'realworld': return <RealWorldPanel />;
    case 'compare': return <ComparePanel />;
    default: return null;
  }
}

export function NoCountry() { const { t } = useGame(); return <p className="muted">{t('dip.choose')}</p>; }
export function ReadOnlyNote({ iso }: { iso: string }) {
  const { t, w, lang, setPlayer } = useGame();
  return <div className="note">{w.countries[iso].flag} {lang === 'fr' ? w.countries[iso].nameFr : w.countries[iso].name} — <button className="link" onClick={() => setPlayer(iso)}>{t('cd.playThis')}</button></div>;
}
