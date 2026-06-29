// GET /api/org/[clientId]/export → CSV registro formativo. ADMIN-ONLY (requireAuth,
// come gli endpoint nominativi: l'HR non potrà mai esportare). SOLO dati
// organizzativi (nome, matricola, date, stato formativo) — nessun campo clinico.
import { requireAuth } from '../../../../lib/auth';
import { getOrgDipendenti, getOrgPartecipazioni, buildRegistroCsv, annoProgramma } from '../../../../lib/org';
import { getClientById } from '../../../../lib/store';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { clientId } = req.query;
  try {
    const [client, dipendenti, partecipazioni] = await Promise.all([
      getClientById(clientId), getOrgDipendenti(clientId), getOrgPartecipazioni(clientId),
    ]);
    const anno = annoProgramma(client, new Date().toISOString().slice(0, 10));
    const csv = buildRegistroCsv(dipendenti, partecipazioni, anno);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="registro-formazione-${clientId}.csv"`);
    return res.send('﻿' + csv); // BOM UTF-8 per Excel
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
