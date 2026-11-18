import test from 'node:test';
import assert from 'node:assert/strict';
import type { GenerateContentResponse } from '@google/genai';
import {
  GEMINI_MODEL_CANDIDATES,
  GEMINI_STORAGE_KEY,
  MAX_RETRIES_PER_MODEL,
  PRIMARY_GEMINI_MODEL,
  PRIORITY_GEMINI_MODELS,
  RETRY_DELAY_MS,
  SAFETY_FALLBACK_GEMINI_MODELS,
  generateContentWithFallback,
  getGeminiApiKey,
  getGeminiKeySource,
  isModelNotFoundError,
  isOverloadOrRateLimitError,
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

test('Gemini model priority order and 404/503/429 error classification', () => {
  assert.equal(PRIMARY_GEMINI_MODEL, 'gemini-3.8-flash');
  assert.deepEqual([...PRIORITY_GEMINI_MODELS], [
    'gemini-3.8-flash',
    'gemini-3.0-flash',
    'gemini-2.5-flash-lite',
  ]);
  assert.deepEqual(GEMINI_MODEL_CANDIDATES.slice(0, 3), [...PRIORITY_GEMINI_MODELS]);
  assert.ok(SAFETY_FALLBACK_GEMINI_MODELS.length > 0);
  assert.equal(MAX_RETRIES_PER_MODEL, 2);
  assert.equal(RETRY_DELAY_MS, 1500);

  assert.equal(
    isModelNotFoundError(new Error('404 NOT_FOUND: models/gemini-3.8-flash is not found')),
    true
  );
  assert.equal(isModelNotFoundError({ status: 404, message: 'Not Found' }), true);
  assert.equal(isModelNotFoundError(new Error('400 API_KEY_INVALID')), false);

  assert.equal(
    isOverloadOrRateLimitError(new Error('503 UNAVAILABLE: The model is overloaded')),
    true
  );
  assert.equal(
    isOverloadOrRateLimitError(new Error('429 RESOURCE_EXHAUSTED: Quota exceeded')),
    true
  );
  assert.equal(isOverloadOrRateLimitError({ status: 503 }), true);
  assert.equal(isOverloadOrRateLimitError({ code: 429 }), true);
  assert.equal(isOverloadOrRateLimitError(new Error('400 API_KEY_INVALID')), false);
});

test('503/429 retries up to 2 times with 1500ms wait before falling back to gemini-3.0-flash', async () => {
  const attempted: string[] = [];
  const delays: number[] = [];
  const statuses: string[] = [];

  const mockAi = {
    models: {
      generateContent: async ({ model }: { model: string }) => {
        attempted.push(model);
        if (model === 'gemini-3.8-flash') {
          throw new Error('503 UNAVAILABLE: server overloaded');
        }
        if (model === 'gemini-3.0-flash' && attempted.filter((m) => m === 'gemini-3.0-flash').length === 1) {
          throw new Error('429 RESOURCE_EXHAUSTED: rate limit');
        }
        return { text: 'OK' } as unknown as GenerateContentResponse;
      },
    },
  };

  const result = await generateContentWithFallback(
    mockAi as never,
    { contents: 'ping' },
    {
      sleepFn: async (ms) => {
        delays.push(ms);
      },
      onStatusChange: (status) => {
        statuses.push(status.message);
      },
    }
  );

  // 1 initial + 2 retries on gemini-3.8-flash, then 1 failure + 1 retry success on gemini-3.0-flash
  assert.deepEqual(attempted, [
    'gemini-3.8-flash',
    'gemini-3.8-flash',
    'gemini-3.8-flash',
    'gemini-3.0-flash',
    'gemini-3.0-flash',
  ]);
  assert.deepEqual(delays, [1500, 1500, 1500]);
  assert.equal(result.usedModel, 'gemini-3.0-flash');
  assert.equal(result.response.text, 'OK');
  assert.ok(statuses.some((m) => m.includes('Máy chủ AI đang đông')));
});

test('404 skips delay and switches immediately across priority models and safety fallback', async () => {
  const attempted: string[] = [];
  const delays: number[] = [];

  const mockAi = {
    models: {
      generateContent: async ({ model }: { model: string }) => {
        attempted.push(model);
        if ((PRIORITY_GEMINI_MODELS as readonly string[]).includes(model)) {
          throw new Error(`{"error":{"code":404,"message":"models/${model} is not found","status":"NOT_FOUND"}}`);
        }
        return { text: 'SAFE_OK' } as unknown as GenerateContentResponse;
      },
    },
  };

  const result = await generateContentWithFallback(
    mockAi as never,
    { contents: 'ping' },
    {
      sleepFn: async (ms) => {
        delays.push(ms);
      },
    }
  );

  assert.deepEqual(attempted, [
    'gemini-3.8-flash',
    'gemini-3.0-flash',
    'gemini-2.5-flash-lite',
    SAFETY_FALLBACK_GEMINI_MODELS[0],
  ]);
  assert.deepEqual(delays, []);
  assert.equal(result.usedModel, SAFETY_FALLBACK_GEMINI_MODELS[0]);
  assert.equal(result.response.text, 'SAFE_OK');
});

test('Non-retryable errors such as invalid API key fail immediately without retry or fallback', async () => {
  const attempted: string[] = [];
  const mockAi = {
    models: {
      generateContent: async ({ model }: { model: string }) => {
        attempted.push(model);
        throw new Error('400 API_KEY_INVALID');
      },
    },
  };

  await assert.rejects(
    () =>
      generateContentWithFallback(mockAi as never, { contents: 'ping' }, { sleepFn: async () => {} }),
    /API_KEY_INVALID/
  );
  assert.deepEqual(attempted, ['gemini-3.8-flash']);
});
