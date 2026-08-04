import { describe, expect, it } from 'vitest';
import { avatarAtSize, initialsFrom } from './avatar';

describe('initialsFrom', () => {
  it('takes the first letter of the first two words of a name', () => {
    expect(initialsFrom('Krishna Ladha', 'x@y.com')).toBe('KL');
    expect(initialsFrom('Vivek Gaggar', 'x@y.com')).toBe('VG');
  });

  it('stops at two, however many names there are', () => {
    expect(initialsFrom('Anjali Rukmini Mehta', 'x@y.com')).toBe('AR');
  });

  it('falls back to the email, splitting on dots and the at-sign', () => {
    // The case that made this worth sharing: on `.` alone this would be K, and on
    // whitespace alone it would be the whole address.
    expect(initialsFrom(null, 'krishna.ladha18@gmail.com')).toBe('KL');
    expect(initialsFrom(undefined, 'vivek@nvrco.in')).toBe('VN');
  });

  it('gives a single initial when there is only one word to take it from', () => {
    expect(initialsFrom('Krishna', 'x@y.com')).toBe('K');
  });

  it('never returns an empty tile', () => {
    expect(initialsFrom('', '')).toBe('?');
    expect(initialsFrom('   ', '')).toBe('?');
  });
});

describe('avatarAtSize', () => {
  const base = 'https://lh3.googleusercontent.com/a/ACg8ocKexample';

  it('rewrites the size Google was going to serve', () => {
    expect(avatarAtSize(`${base}=s96-c`, 128)).toBe(`${base}=s128-c`);
    expect(avatarAtSize(`${base}=s400`, 64)).toBe(`${base}=s64-c`);
  });

  it('asks for a size when the URL carries none', () => {
    expect(avatarAtSize(base, 72)).toBe(`${base}=s72-c`);
  });

  it('works across their numbered CDN hosts', () => {
    expect(avatarAtSize('https://lh5.googleusercontent.com/a/x=s96-c', 128)).toBe(
      'https://lh5.googleusercontent.com/a/x=s128-c',
    );
  });

  it('leaves other hosts alone', () => {
    // Another provider, or a Supabase storage URL, whose scheme we do not know.
    const other = 'https://avatars.example.com/u/1234.png';
    expect(avatarAtSize(other, 128)).toBe(other);
  });

  it('leaves a Google URL alone when it carries some other parameter', () => {
    // Appending a second `=` clause is how you turn a working URL into a 404.
    const odd = `${base}=w200-h200`;
    expect(avatarAtSize(odd, 128)).toBe(odd);
  });
});
