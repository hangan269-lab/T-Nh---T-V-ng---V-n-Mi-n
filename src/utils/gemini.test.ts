import test from 'node:test';
import assert from 'node:assert/strict';
import type { GenerateContentResponse } from '@google/genai';
import {
  GEMINI_MODEL_CANDIDATES,
  GEMINI_STORAGE_KEY,
  PRIMARY_GEMINI_MODEL,
  generateContentWithFallback,
  getGeminiApiKey,
  getGeminiKeySource,
  isModelNotFoundError,
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

test('Gemini model configuration defaults to gemini-3.8-flash and falls back on 404', async () => {
  assert.equal(PRIMARY_GEMINI_MODEL, 'gemini-3.8-flash');
  assert.equal(GEMINI_MODEL_CANDIDATES[0], 'gemini-3.8-flash');
  assert.ok(GEMINI_MODEL_CANDIDATES.length >= 2);

  assert.equal(isModelNotFoundError(new Error('404 NOT_FOUND: models/gemini-3.8-flash is not found')), true);
  assert.equal(isModelNotFoundError({ status: 404, message: 'Not Found' }), true);
  assert.equal(isModelNotFoundError(new Error('400 API_KEY_INVALID')), false);

  const attempted: string[] = [];
  const mockAi = {
    models: {
      generateContent: async ({ model }: { model: string }) => {
        attempted.push(model);
        if (model === 'gemini-3.8-flash') {
          throw new Error('{"error":{"code":404,"message":"models/gemini-3.8-flash is not found","status":"NOT_FOUND"}}');
        }
        return { text: 'OK' } as unknown as GenerateContentResponse;
      },
    },
  };

  const result = await generateContentWithFallback(mockAi as never, { contents: 'ping' });
  assert.deepEqual(attempted, ['gemini-3.8-flash', GEMINI_MODEL_CANDIDATES[1]]);
  assert.equal(result.usedModel, GEMINI_MODEL_CANDIDATES[1]);
  assert.equal(result.response.text, 'OK');
});

test('Gemini fallback does not retry non-404 errors such as invalid API key', async () => {
  const attempted: string[] = [];
  const mockAi = {
    models: {
      generateContent: async ({ model }: { model: string }) => {
        attempted.push(model);
        throw new Error('API_KEY_INVALID');
      },
    },
  };

  await assert.rejects(
    () => generateContentWithFallback(mockAi as never, { contents: 'ping' }),
    /API_KEY_INVALID/
  );
  assert.deepEqual(attempted, ['gemini-3.8-flash']);
});
