import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GEMINI_STORAGE_KEY,
  getGeminiApiKey,
  getGeminiKeySource,
  saveGeminiApiKey,
} from './gemini';

// Mock localStorage for node environment
class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

test('Gemini API key management: custom localStorage priority and clear', () => {
  const origWindow = globalThis.window;
  const mockStorage = new MockLocalStorage();
  // @ts-expect-error test mock
  globalThis.window = { localStorage: mockStorage };
  // @ts-expect-error test mock
  globalThis.localStorage = mockStorage;

  try {
    assert.equal(getGeminiKeySource(), 'none');
    assert.equal(getGeminiApiKey(), '');

    // Set custom key
    saveGeminiApiKey('AIzaSyTest12345');
    assert.equal(getGeminiKeySource(), 'custom');
    assert.equal(getGeminiApiKey(), 'AIzaSyTest12345');

    // Clear key
    saveGeminiApiKey('');
    assert.equal(getGeminiKeySource(), 'none');
    assert.equal(getGeminiApiKey(), '');
  } finally {
    globalThis.window = origWindow;
  }
});
