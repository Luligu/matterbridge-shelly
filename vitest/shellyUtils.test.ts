/**
 * @file vitest/shellyUtils.test.ts
 * @description This file contains the tests for the Shelly utility functions.
 * @author Luca Liguori
 */

import { normalizeId } from '../src/shellyUtils.js';

describe('shellyUtils', () => {
  test('normalizeId', () => {
    expect(normalizeId('Shelly1-34945472A643').id).toBe('shelly1-34945472A643');
    expect(normalizeId('shelly1-34945472a643').type).toBe('shelly1');
    expect(normalizeId('Shelly1-34945472a643').mac).toBe('34945472A643');

    expect(normalizeId('shellyPlug-S-C38Eab').id).toBe('shellyplug-s-C38EAB');
    expect(normalizeId('shellyPlug-S-C38Eab').type).toBe('shellyplug-s');
    expect(normalizeId('ShellyPlug-S-C38Eab').mac).toBe('C38EAB');
  });

  test('normalizeId should handle edge cases', () => {
    expect(normalizeId('device').id).toBe('device');
    expect(normalizeId('device').type).toBe('');
    expect(normalizeId('device').mac).toBe('');

    expect(normalizeId('device-').id).toBe('device-');
    expect(normalizeId('device-').type).toBe('');
    expect(normalizeId('device-').mac).toBe('');
  });
});
