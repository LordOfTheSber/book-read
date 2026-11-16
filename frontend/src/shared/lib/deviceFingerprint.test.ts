import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeviceFingerprint, resetDeviceFingerprintCache } from './deviceFingerprint';

describe('deviceFingerprint', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDeviceFingerprintCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('считает отпечаток один раз и повторяет его в том же браузере', async () => {
    const first = await getDeviceFingerprint();
    resetDeviceFingerprintCache();
    const second = await getDeviceFingerprint();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  /** Метка в localStorage разводит два браузера на одном компьютере: это разные устройства. */
  it('меняется вместе с меткой устройства', async () => {
    const first = await getDeviceFingerprint();

    localStorage.clear();
    resetDeviceFingerprintCache();
    const afterReset = await getDeviceFingerprint();

    expect(afterReset).not.toBe(first);
  });

  /**
   * Без защищённого соединения `crypto.subtle` недоступен. Быстрый вход в этом случае просто
   * не предлагается — обещать его и молча не выполнить хуже, чем обойтись паролем.
   */
  it('молчит там, где считать нечем', async () => {
    vi.stubGlobal('crypto', {});

    expect(await getDeviceFingerprint()).toBeUndefined();
  });
});
