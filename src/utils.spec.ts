import { deepEqual, deepCopy, getIpv4InterfaceAddress, getIpv6InterfaceAddress } from 'matterbridge';
import { shellyplus2pmShelly, shellyplus2pmStatus, shellyplus2pmSettings } from './shellyplus2pm';
import { ShellyData } from './shellyTypes';

describe('Utils test', () => {
  const obj1 = {
    a: 1,
    b: '2',
    c: {
      d: 3,
      e: '4',
    },
  };

  const obj2 = {
    a: 1,
    b: '2',
    c: {
      d: 3,
      e: '4',
    },
  };

  test('Deep equal', () => {
    expect(deepEqual(obj1, obj2)).toBeTruthy();
  });

  test('Deep copy', () => {
    const copy = deepCopy(obj1);
    expect(deepEqual(obj1, copy)).toBeTruthy();
  });

  test('Deep equal false', () => {
    expect(deepEqual(shellyplus2pmShelly, shellyplus2pmStatus)).toBeFalsy();
  });

  test('Deep equal true', () => {
    expect(deepEqual(shellyplus2pmShelly, shellyplus2pmShelly)).toBeTruthy();
  });

  test('Deep copy Shelly', () => {
    const copy = deepCopy(shellyplus2pmShelly);
    expect(deepEqual(shellyplus2pmShelly, copy)).toBeTruthy();
  });

  test('Deep copy Status', () => {
    const copy = deepCopy(shellyplus2pmStatus);
    expect(deepEqual(shellyplus2pmStatus, copy)).toBeTruthy();
  });

  test('Deep copy Settings', () => {
    const copy = deepCopy(shellyplus2pmSettings);
    if (copy.ws) (copy.ws as ShellyData).enable = true;
    expect(deepEqual(shellyplus2pmSettings, copy)).toBeFalsy();
  });

  test('Address ipv4', () => {
    expect(getIpv4InterfaceAddress()).toBe('192.168.1.189');
  });

  test('Address ipv6', () => {
    expect(getIpv6InterfaceAddress()).toBe('fd78:cbf8:4939:746:d555:85a9:74f6:9c6');
  });
});
