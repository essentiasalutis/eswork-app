// ─────────────────────────────────────────────────────────────────────────────
// Loader dei parametri pricing v2 (SOLO SERVER: importa il client service_role).
// Fonde gli override admin di pricing_settings (v38) sui default del codice
// (DEFAULTS_V2 in ./v2): il motore resta puro e riceve i parametri già risolti.
// I testi (argomentari, naming cliente-facing, testo evoluzione) restano in
// `texts` e NON entrano nei fattori numerici. Fail-safe: DB irraggiungibile o
// valore non numerico → default del codice (mai un calcolo con NaN).
// ─────────────────────────────────────────────────────────────────────────────
import supabase from '../db';
import { DEFAULTS_V2 } from './v2';

const NUMERIC_KEYS = new Set(Object.keys(DEFAULTS_V2));

export async function getPricingSettingsV2() {
  const params = { ...DEFAULTS_V2 };
  const texts = {};
  try {
    const { data, error } = await supabase.from('pricing_settings').select('key,value').eq('version', 'v2');
    if (error) throw error;
    for (const row of data || []) {
      if (NUMERIC_KEYS.has(row.key)) {
        const v = Number(row.value);
        if (Number.isFinite(v)) params[row.key] = v;
      } else {
        texts[row.key] = row.value;
      }
    }
  } catch (_) { /* fail-safe: default del codice */ }
  return { params, texts };
}

export async function updatePricingSettingV2(key, value) {
  const { error } = await supabase
    .from('pricing_settings')
    .upsert({ version: 'v2', key, value: String(value), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return { ok: true };
}
