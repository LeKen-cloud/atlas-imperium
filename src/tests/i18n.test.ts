import { en } from '../i18n/en';
import { fr } from '../i18n/fr';
it('French and English dictionaries have the same keys', () => {
  const a = Object.keys(en).filter((k) => !(k in fr)), b = Object.keys(fr).filter((k) => !(k in en));
  expect({ missingInFr: a, missingInEn: b }).toEqual({ missingInFr: [], missingInEn: [] });
});
