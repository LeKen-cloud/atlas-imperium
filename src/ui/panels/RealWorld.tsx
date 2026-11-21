import { useState } from 'react';
import { useGame, Section, Prov, CountryPicker } from '../common';
import { CONTEXT_SOURCES, VERIFIED_LEADERS, BUILD_DATE } from '../../data/reference';
import { RealMarkets } from './Markets';
import { fetchNews, fetchWorldBank, fetchLeaders, fetchFX, fetchQuotes, type RealItem } from '../../realdata/live';

export function RealWorldPanel() {
  const { w, t, lang, ai, selected, bump, toast } = useGame();
  const [iso, setIso] = useState<string | null>(selected || w.player);
  const [news, setNews] = useState<RealItem[] | null>(null); const [wb, setWb] = useState<RealItem[] | null>(null);
  const [fx, setFx] = useState<RealItem[] | null>(null); const [quotes, setQuotes] = useState<RealItem[] | null>(null);
  const [leaders, setLeaders] = useState<Record<string, { hos?: string; hog?: string }> | null>(null);
  const [err, setErr] = useState<string[]>([]); const [busy, setBusy] = useState('');
  const run = async (k: string, f: () => Promise<void>, src: string) => { setBusy(k); try { await f(); } catch { setErr((e) => [...e, t('rw.error', { s: src })]); } setBusy(''); };
  const List = ({ items }: { items: RealItem[] | null }) => items ? <ul className="rw">{items.map((x, i) => <li key={i}>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.title}</a> : x.title}<small className="muted"> · {t('rw.source')}: {x.source} · {t('rw.published')}: {x.date} · {t('rw.coverage')}: {x.coverage} · {t('rw.reliability')}: {t('rw.' + x.reliability)}</small></li>)}{!items.length && <li className="muted">—</li>}</ul> : null;
  return (
    <div>
      <div className="note real">{t('rw.note')} <Prov p="verified" /></div>
      {w.diverged && <p className="muted small">{t('rw.diverged')}</p>}
      <Section title={t('rw.context')} right={<span className="small muted">{BUILD_DATE}</span>}>
        <ul className="rw">{CONTEXT_SOURCES.map((c) => <li key={c.id}>{c.text} <small className="muted">· <a href={c.url} target="_blank" rel="noreferrer">{c.src}</a></small></li>)}
          {Object.entries(VERIFIED_LEADERS).map(([k, v]) => <li key={k}>{w.countries[k]?.flag} {k}: {v.hos}{v.hog && v.hog !== v.hos ? ' / ' + v.hog : ''} <small className="muted">· {v.src}</small></li>)}</ul>
      </Section>
      <Section title={t('rw.markets')}><RealMarkets /></Section>
      <Section title={t('rw.live')}>
        <p className="muted small">{t('rw.liveUnavailable')}</p>
        {err.map((e, i) => <p key={i} className="err small">{e}</p>)}
        <h4>{t('rw.news')} <button className="btn sm" disabled={!!busy} onClick={() => run('n', async () => setNews(await fetchNews()), 'GDELT')}>{busy === 'n' ? '…' : t('rw.fetch')}</button></h4><List items={news} />
        <h4>{t('rw.wb')} <CountryPicker value={iso} onChange={setIso} /> <button className="btn sm" disabled={!!busy || !iso} onClick={() => iso && run('w', async () => setWb(await fetchWorldBank(iso)), 'World Bank')}>{busy === 'w' ? '…' : t('rw.fetch')}</button></h4><List items={wb} />
        <h4>FX (ECB) <button className="btn sm" disabled={!!busy} onClick={() => run('f', async () => setFx((await fetchFX()).slice(0, 30)), 'Frankfurter')}>{busy === 'f' ? '…' : t('rw.fetch')}</button></h4><List items={fx} />
        {ai.avKey && <><h4>Alpha Vantage <button className="btn sm" disabled={!!busy} onClick={() => run('q', async () => setQuotes(await fetchQuotes(ai.avKey!)), 'Alpha Vantage')}>{busy === 'q' ? '…' : t('rw.fetch')}</button></h4><List items={quotes} /></>}
        <h4>{t('rw.leaders')} <button className="btn sm" disabled={!!busy} onClick={() => run('l', async () => setLeaders(await fetchLeaders()), 'Wikidata')}>{busy === 'l' ? '…' : t('rw.fetch')}</button></h4>
        {leaders && <>
          <ul className="rw">{Object.entries(leaders).filter(([k]) => w.countries[k]).slice(0, 400).map(([k, v]) => <li key={k}>{w.countries[k].flag} {lang === 'fr' ? w.countries[k].nameFr : w.countries[k].name}: {v.hos || '—'}{v.hog && v.hog !== v.hos ? ' / ' + v.hog : ''}</li>)}</ul>
          <button className="btn" disabled={w.diverged} onClick={() => { const d = new Date().toISOString().slice(0, 10); for (const [k, v] of Object.entries(leaders)) { const c = w.countries[k]; if (!c) continue; c.gov.headOfState = v.hos || c.gov.headOfState; c.gov.headOfGov = v.hog || c.gov.headOfGov; c.gov.leaderTag = { prov: 'verified', src: 'Wikidata (live)', date: d }; } bump(); toast('✓', 'ok'); }}>{t('rw.apply')}</button>
        </>}
      </Section>
    </div>
  );
}
