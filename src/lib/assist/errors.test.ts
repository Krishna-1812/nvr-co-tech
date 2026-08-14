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
 */

describe('rate limits', () => {
  it('says to wait, without mentioning billing', () => {
    const message = describeApiFailure(429, { error: { type: 'rate_limit_error', message: 'Too many requests' } });

    expect(message).toMatch(/Give it a minute/);
    expect(message).not.toMatch(/billing/);
  });

  it('passes on how long to wait when Anthropic sent one', () => {
    const message = describeApiFailure(429, { error: { type: 'rate_limit_error' } }, 29);
    expect(message).toMatch(/about 29 seconds/);
  });

  it('rounds a wait of one second to the singular', () => {
    expect(describeApiFailure(429, { error: { type: 'rate_limit_error' } }, 1)).toMatch(/about 1 second\./);
  });
});

describe('other failures from Anthropic', () => {
  it('names a refused key from the error type', () => {
    const message = describeApiFailure(401, { error: { type: 'authentication_error', message: 'invalid x-api-key' } });

    expect(message).toMatch(/was refused/);
    expect(message).toMatch(/Nobody can fix that from this screen/);
  });

  it('names a permission failure', () => {
    expect(describeApiFailure(403, { error: { type: 'permission_error' } })).toMatch(/not allowed to do this/);
  });

  it('names the model, and the variable that changes it', () => {
    const message = describeApiFailure(404, { error: { type: 'not_found_error' } });
    expect(message).toContain(MODEL);
    expect(message).toContain('ANTHROPIC_MODEL');
  });

  it('says a request that is too large plainly', () => {
    expect(describeApiFailure(413, { error: { type: 'request_too_large_error' } })).toMatch(/too long for one request/);
  });

  it('says the servers are overloaded, not that the reader did something wrong', () => {
    expect(describeApiFailure(529, { error: { type: 'overloaded_error' } })).toMatch(/overloaded/);
  });

  it('says a server error will probably clear on its own', () => {
    expect(describeApiFailure(500, { error: { type: 'api_error' } })).toMatch(/problem at its end/);
  });

  it('passes a rejected field through, because it names itself', () => {
    expect(
      describeApiFailure(400, { error: { type: 'invalid_request_error', message: 'max_tokens: field required' } }),
    ).toContain('max_tokens');
  });

  it('still says something when the body is an HTML gateway page', () => {
    expect(describeApiFailure(502, null).length).toBeGreaterThan(20);
  });
});

describe('why an answer stopped', () => {
  it('says nothing when it simply finished', () => {
    // A note under every answer would be noise on all of them.
    expect(describeStopReason('end_turn')).toBeNull();
    expect(describeStopReason('stop_sequence')).toBeNull();
    expect(describeStopReason(null)).toBeNull();
  });

  it('says nothing for a reason nobody has seen before', () => {
    expect(describeStopReason('something_new')).toBeNull();
  });

  it('explains running out of room, and says the answer can be continued', () => {
    expect(describeStopReason('max_tokens')).toMatch(/Ask for the rest/);
  });

  it('explains a refusal without blaming the reader', () => {
    expect(describeStopReason('refusal')).toMatch(/Rewording the question/);
  });
});

describe('failures before Anthropic answered', () => {
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
    describeApiFailure(429, { error: { type: 'rate_limit_error' } }),
    describeApiFailure(401, { error: { type: 'authentication_error' } }),
    describeApiFailure(403, { error: { type: 'permission_error' } }),
    describeApiFailure(404, { error: { type: 'not_found_error' } }),
    describeApiFailure(500, { error: { type: 'api_error' } }),
    describeTransportFailure(new DOMException('x', 'AbortError')),
    describeTransportFailure(new Error('fetch failed')),
    ...['max_tokens', 'refusal'].map((r) => describeStopReason(r) as string),
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
