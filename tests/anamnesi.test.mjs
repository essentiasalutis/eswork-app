import test from 'node:test';
import assert from 'node:assert/strict';
import { anamnesiGiaCompilata } from '../lib/anamnesi.mjs';

test('anamnesi già compilata: da non sovrascrivere', () => {
  assert.equal(anamnesiGiaCompilata([{ type: 'anamnesi', status: 'completed' }]), true);
  assert.equal(anamnesiGiaCompilata([{ type: 'anamnesi', status: 'signed' }]), true);
});

test('prima compilazione ancora possibile', () => {
  assert.equal(anamnesiGiaCompilata([]), false);
  assert.equal(anamnesiGiaCompilata([{ type: 'consent_treatment', status: 'signed' }]), false);
  assert.equal(anamnesiGiaCompilata([{ type: 'anamnesi', status: 'draft' }]), false);
});
