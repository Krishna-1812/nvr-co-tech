import { describe, expect, it } from 'vitest';
import { MODEL } from './config';
import {
  NO_KEY,
  describeApiFailure,
  describeStopReason,
  describeTransportFailure,
} from './errors';

/**
 * The failure messages.
 *
 * Tested because the things that go wrong here have different owners, and a chat
 * window that says "something went wrong" to all of them is the least useful
 * screen in software.
 *
 * The pair worth the most care is the two 429s. Gemini reports "slow down" and
 * "your key has no access to this model at all" with the same status code, and
 * only one of them is fixed by waiting.
 */

describe('the two quota failures, which share a status code', () => {
  const planLimit = {
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      message:
        'You exceeded your current quota. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-3.1-pro-preview',
    },
  };

  it('reads a quota of zero as no access, and says what to do about it', () => {
    const message = describeApiFailure(429, planLimit);

    expect(message).toMatch(/waiting will not help/);
    expect(message).toMatch(/enable billing/);
    expect(message).toMatch(/GEMINI_MODEL/);
    // Naming the model matters: the reader has to know which one to change.
    expect(message).toContain(MODEL);
  });

  it('says which family is free, since that is the actual fix', () => {
    expect(describeApiFailure(429, planLimit)).toMatch(/Flash models are free/);
  });

  it('reads an ordinary rate limit as one, and does not mention billing', () => {
    const message = describeApiFailure(429, {
      error: { status: 'RESOURCE_EXHAUSTED', message: 'Too many requests. limit: 60' },
    });

    expect(message).toMatch(/Give it a minute/);
    expect(message).not.toMatch(/billing/);
  });

  it('passes on how long to wait, since Google says', () => {
    // The free tier allows twenty requests a minute and one question can be
    // several, so this fires often. "About twenty seconds" is a thing somebody
    // will wait for; "give it a minute" is a thing they will give up on.
    const message = describeApiFailure(429, {
      error: {
        status: 'RESOURCE_EXHAUSTED',
        message:
          'Quota exceeded for metric: generate_content_free_tier_requests, limit: 20. Please retry in 28.830214809s.',
      },
    });

    expect(message).toMatch(/about 29 seconds/);
  });

  it('rounds a wait of one second to the singular', () => {
    expect(
      describeApiFailure(429, { error: { message: 'limit: 20. Please retry in 0.4s.' } }),
    ).toMatch(/about 1 second\./);
  });

  it('does not mistake a limit of 60 for a limit of 0', () => {
    expect(describeApiFailure(429, { error: { message: 'limit: 600' } })).toMatch(/Give it a minute/);
  });
});

describe('other failures from Gemini', () => {
  it('names a refused key from the message, since the status is only a 400', () => {
    const message = describeApiFailure(400, {
      error: { message: 'API key not valid. Please pass a valid API key.' },
    });

    expect(message).toMatch(/was refused/);
    expect(message).toMatch(/Nobody can fix that from this screen/);
  });

  it('names a refused key from an UNAUTHENTICATED status too', () => {
    expect(describeApiFailure(401, { error: { status: 'UNAUTHENTICATED' } })).toMatch(/was refused/);
  });

  it('names the model, and the variable that changes it', () => {
    const message = describeApiFailure(404, { error: { status: 'NOT_FOUND' } });
    expect(message).toContain(MODEL);
    expect(message).toContain('GEMINI_MODEL');
  });

  it('says a server error will probably clear on its own', () => {
    expect(describeApiFailure(503, null)).toMatch(/problem at its end/);
  });

  it('passes a rejected field through, because it names itself', () => {
    // The person reading this is the person who wrote the schema.
    expect(
      describeApiFailure(400, {
        error: { message: 'Unknown name "additionalProperties" at tools[0]' },
      }),
    ).toContain('additionalProperties');
  });

  it('still says something when the body is an HTML gateway page', () => {
    expect(describeApiFailure(502, null).length).toBeGreaterThan(20);
  });
});

describe('why an answer stopped', () => {
  it('says nothing when it simply finished', () => {
    // A note under every answer would be noise on all of them.
    expect(describeStopReason('STOP')).toBeNull();
    expect(describeStopReason(null)).toBeNull();
  });

  it('says nothing for a reason nobody has seen before', () => {
    expect(describeStopReason('SOMETHING_NEW')).toBeNull();
  });

  it('explains running out of room, and says the answer can be continued', () => {
    expect(describeStopReason('MAX_TOKENS')).toMatch(/Ask for the rest/);
  });

  it('explains a safety stop without blaming the reader', () => {
    for (const reason of ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST']) {
      expect(describeStopReason(reason)).toMatch(/Rewording the question/);
    }
  });

  it('explains a recitation stop', () => {
    expect(describeStopReason('RECITATION')).toMatch(/reproducing a source/);
  });

  it('explains a call this app could not read', () => {
    expect(describeStopReason('MALFORMED_FUNCTION_CALL')).toMatch(/could not read/);
  });
});

describe('failures before Gemini answered', () => {
  it('explains a timeout as one, and suggests something', () => {
    const message = describeTransportFailure(new DOMException('aborted', 'AbortError'));
    expect(message).toMatch(/taking too long/);
    expect(message).toMatch(/shorter question/);
  });

  it("says a connection problem is not the reader's fault", () => {
    expect(describeTransportFailure(new Error('fetch failed'))).toMatch(
      /rather than anything you did/,
    );
  });

  it('has an answer for something it has never seen', () => {
    expect(describeTransportFailure({ weird: true })).toMatch(/Please try again/);
  });
});

describe('house style', () => {
  const all = [
    NO_KEY,
    describeApiFailure(429, { error: { message: 'limit: 0' } }),
    describeApiFailure(429, {}),
    describeApiFailure(401, {}),
    describeApiFailure(403, {}),
    describeApiFailure(404, {}),
    describeApiFailure(500, {}),
    describeTransportFailure(new DOMException('x', 'AbortError')),
    describeTransportFailure(new Error('fetch failed')),
    ...['MAX_TOKENS', 'SAFETY', 'RECITATION', 'MALFORMED_FUNCTION_CALL'].map(
      (r) => describeStopReason(r) as string,
    ),
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
