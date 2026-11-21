import { useGame } from './common';
import { fmtDate } from '../i18n';
import { CAT_COLORS, CAT_ICONS } from './theme';

export function NewsTicker() {
  const { w, t, lang, setPanel, focus } = useGame();
  const items = w.news.filter((n) => n.severity >= 2 || (w.player && n.countries.includes(w.player))).slice(0, 8);
  return (
    <footer className="ticker">
      <button className="btn sm" onClick={() => setPanel('news')}>{t('nav.news')}</button>
      <div className="tk-in">
        {items.length === 0 && <span className="muted">{t('news.empty')}</span>}
        {items.map((n) => <button key={n.id} style={{ ['--nc' as any]: CAT_COLORS[n.cat] }} className={'tk sev' + n.severity} onClick={() => { setPanel('news'); if (n.link) focus(n.link); }}>
          <span className="tk-ic">{CAT_ICONS[n.cat]}</span> <span className="tk-d">{fmtDate(w, n.t, lang)}</span> {t(n.key, n.params)}
        </button>)}
      </div>
    </footer>
  );
}
