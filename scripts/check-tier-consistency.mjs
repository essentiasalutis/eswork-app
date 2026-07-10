// Guardia soglie tier — asserisce che pricing_settings (v2) combaci con la costante JS
// (lib/pricing/tier.js). Se divergono → exit 1: un cambio di soglia applicato solo da un
// lato (JS senza pricing_settings, o viceversa) FALLISCE qui invece di passare in silenzio.
// Esegui quando cambi le soglie e prima di un deploy:  node scripts/check-tier-consistency.mjs
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { TIER_CORE_MAX, TIER_PLUS_MAX } from '../lib/pricing/tier.js';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const g = k => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null; };
const sb = createClient(g('SUPABASE_URL'), g('SUPABASE_SERVICE_KEY'));

const { data, error } = await sb.from('pricing_settings').select('key,value').eq('version', 'v2').in('key', ['tier_core_max', 'tier_plus_max']);
if (error) { console.error('❌ impossibile leggere pricing_settings:', error.message); process.exit(2); }
const m = Object.fromEntries((data || []).map(r => [r.key, parseInt(r.value)]));

const problems = [];
if (m.tier_core_max !== TIER_CORE_MAX) problems.push(`tier_core_max: pricing_settings=${m.tier_core_max ?? '(assente)'} ≠ JS=${TIER_CORE_MAX}`);
if (m.tier_plus_max !== TIER_PLUS_MAX) problems.push(`tier_plus_max: pricing_settings=${m.tier_plus_max ?? '(assente)'} ≠ JS=${TIER_PLUS_MAX}`);

if (problems.length) {
  console.error('❌ SOGLIE TIER DIVERGENTI:\n  ' + problems.join('\n  ') + '\n  → allinea pricing_settings (Listino v2) e lib/pricing/tier.js.');
  process.exit(1);
}
console.log(`✅ soglie tier coerenti: core=${TIER_CORE_MAX} plus=${TIER_PLUS_MAX} (pricing_settings == lib/pricing/tier.js)`);
