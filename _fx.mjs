import fs from 'fs'; import crypto from 'crypto'; import { createClient } from '@supabase/supabase-js';
const env=fs.readFileSync('.env.local','utf8'); const g=k=>{const m=env.match(new RegExp('^'+k+'=(.*)$','m'));return m?m[1].trim().replace(/^["']|["']$/g,''):null;};
export const sb=createClient(g('SUPABASE_URL'),g('SUPABASE_SERVICE_KEY'));
export const BASE='http://localhost:3320';
export const CID='c_COMM_zz', FMID='fm_COMM_zz', TOKEN='zz'+crypto.createHash('sha256').update('comm-test').digest('hex').slice(0,46);
const sign=(p)=>{const d=Buffer.from(JSON.stringify(p)).toString('base64url');return d+'.'+crypto.createHmac('sha256',g('SESSION_SECRET')).update(d).digest('base64url');};
export const H={'Content-Type':'application/json',cookie:'esw_session='+sign({email:g('ADMIN_EMAIL'),role:'admin',exp:Date.now()+3*3600e3})};
export const COOKIE=H.cookie.split('=').slice(1).join('=');
export async function clean(){
  const dips=(await sb.from('org_dipendente').select('id').eq('client_id',CID)).data||[];
  for(const d of dips){ await sb.from('org_partecipazione_formativa').delete().eq('dipendente_id',d.id); await sb.from('org_duplicato_validazione').delete().eq('dipendente_id',d.id); }
  for(const t of ['org_comunicazione','org_sessione_formativa','org_dipendente','first_meetings']) await sb.from(t).delete().eq('client_id',CID);
  await sb.from('clients').delete().eq('id',CID);
}
export async function setup(){
  await clean(); const now=new Date().toISOString();
  const E=(r,w)=>{if(r.error) throw new Error(w+': '+r.error.message);};
  E(await sb.from('clients').insert({id:CID,name:'Prova COMUNICAZIONI',sector:1,employees:40,pricing_version:'v2',tipo_prodotto:'programma_completo',tier:'core',is_demo:true,
     hr_ingressi_token:TOKEN,data_avvio_programma:'2026-01-01',capienza_gruppo:20,soglia_x:3,created_at:now}),'cl');
  E(await sb.from('first_meetings').insert({id:FMID,client_id:CID,employees:40,sector:1,created_at:now,updated_at:now,
     data:{step1:{sector:'manufacturing'},step2:{sedi:[{nome:'S',employees:40}]},step3:{},params:{rates:{sportello_sell:120,sportello_cost:60,prevalidation_sell:30,prevalidation_cost:15,training_sell:250,training_cost:100},l2_mult:2,vat_exempt:true}}}),'fm');
}
