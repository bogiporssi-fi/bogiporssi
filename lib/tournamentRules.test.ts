import assert from 'node:assert/strict';
import test from 'node:test';
import { getTournamentPricingMode } from './tournamentRules.ts';

test('hinnoittelutapa puuttuu tai on tuntematon → absolute', () => {
  assert.equal(getTournamentPricingMode(null), 'absolute');
  assert.equal(getTournamentPricingMode(undefined), 'absolute');
  assert.equal(getTournamentPricingMode({}), 'absolute');
  assert.equal(getTournamentPricingMode({ pricing_mode: null }), 'absolute');
  assert.equal(getTournamentPricingMode({ pricing_mode: '' }), 'absolute');
  assert.equal(getTournamentPricingMode({ pricing_mode: 'absolute' }), 'absolute');
  assert.equal(getTournamentPricingMode({ pricing_mode: 'percentile' }), 'absolute');
  assert.equal(getTournamentPricingMode({ format: 'mpo_pairs' }), 'absolute');
});

test('vain relative kytkee suhteellisen hinnoittelun', () => {
  assert.equal(getTournamentPricingMode({ pricing_mode: 'relative' }), 'relative');
  assert.equal(getTournamentPricingMode({ pricing_mode: 'Relative' }), 'absolute');
});
