import { describe, expect, it } from 'vitest';
import { MODEL } from './config';
import { NO_KEY, describeApiFailure, describeTransportFailure } from './errors';

/**
 * The failure messages.
 *
 * Tested because the four things that go wrong here have four different owners,
 * and a chat window that says "something went wrong" to all of them is the least
 * useful screen in software. A refused key and an exhausted balance look
 * identical to a reader and only one of them is fixed by waiting.
 *
 * Also tested for house style, since these are read by customers.
 */

describe('failures from OpenAI', () => {
  it('names an exhausted balance, and says the rest of the app is fine', () => {
    const message = describeApiFailure(429, {
      error: { code: 'credit_balance_exhausted', type: 'insufficient_quota' },
    });

    expect(message).toMatch(/no credits left/);
    expect(message).toMatch(/Everything else on this platform is unaffected/);
  });

  it('recognises an exhausted balance from the type alone', () => {
    expect(describeApiFailure(429, { error: { type: 'insufficient_quota' } })).toMatch(
      /no credits left/,
    );
  });

  it('tells a plain rate limit apart from an exhausted balance', () => {
    // Same status code, completely different thing to do about it.
    const message = describeApiFailure(429, { error: { type: 'rate_limit_exceeded' } });
    expect(message).toMatch(/Give it a moment/);
    expect(message).not.toMatch(/credits/);
  });

  it('names a refused key and says nobody can fix it from this screen', () => {
    const message = describeApiFailure(401, { error: { code: 'invalid_api_key' } });
    expect(message).toMatch(/was refused/);
    expect(message).toMatch(/Nobody can fix that from this screen/);
  });

  it('names the model, and the variable that changes it', () => {
    const message = describeApiFailure(404, { error: { code: 'model_not_found' } });
    expect(message).toContain(MODEL);
    expect(message).toContain('OPENAI_MODEL');
  });

  it('recognises no access to a model from the wording as well as the code', () => {
    expect(
      describeApiFailure(403, { error: { message: 'You do not have access to model x' } }),
    ).toContain('OPENAI_MODEL');
  });

  it('says a server error will probably clear on its own', () => {
    expect(describeApiFailure(503, null)).toMatch(/problem at its end/);
  });

  it('passes a rejected parameter through, because it names itself', () => {
    // The person reading this is the person who set it.
    expect(
      describeApiFailure(400, { error: { message: "Unknown parameter: 'reasoning.effort'" } }),
    ).toContain("Unknown parameter: 'reasoning.effort'");
  });

  it('still says something when the body is an HTML gateway page', () => {
    expect(describeApiFailure(502, null).length).toBeGreaterThan(20);
  });
});

describe('failures before OpenAI answered', () => {
  it('explains a timeout as one, and suggests something', () => {
    const message = describeTransportFailure(new DOMException('aborted', 'AbortError'));
    expect(message).toMatch(/taking too long/);
    expect(message).toMatch(/shorter question/);
  });

  it("says a connection problem is not the reader's fault", () => {
    expect(describeTransportFailure(new Error('fetch failed'))).toMatch(/rather than anything you did/);
  });

  it('has an answer for something it has never seen', () => {
    expect(describeTransportFailure({ weird: true })).toMatch(/Please try again/);
  });
});

describe('house style', () => {
  const all = [
    NO_KEY,
    describeApiFailure(429, { error: { code: 'credit_balance_exhausted' } }),
    describeApiFailure(401, {}),
    describeApiFailure(403, {}),
    describeApiFailure(500, {}),
    describeApiFailure(404, { error: { code: 'model_not_found' } }),
    describeTransportFailure(new DOMException('x', 'AbortError')),
    describeTransportFailure(new Error('fetch failed')),
  ];

  it('never uses an em-dash', () => {
    for (const message of all) expect(message).not.toMatch(/—/);
  });

  it('always says something, and never a bare code', () => {
    for (const message of all) {
      expect(message.length).toBeGreaterThan(30);
      expect(message).toMatch(/[.!]$/);
    }
  });
});
