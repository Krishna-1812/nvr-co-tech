import { describe, expect, it } from 'vitest';
import { PDF_SANS, fitWords, fontStack, textFont } from './fonts';

describe('fontStack', () => {
  it('asks for Figtree alone when the text is all Latin, so no script face is fetched', () => {
    expect(fontStack(['Skyline Towers, B-1204', 'Booking amount ₹5,00,000'])).toEqual([PDF_SANS]);
  });

  it('adds a face for each Indian script the text uses, and only those', () => {
    expect(fontStack(['Booking (बुकिंग)', 'પાર્કિંગ'])).toEqual([PDF_SANS, 'PDF Devanagari', 'PDF Gujarati']);
    expect(fontStack(['முன்பணம்'])).toEqual([PDF_SANS, 'PDF Tamil']);
  });
});

describe('textFont', () => {
  it('leads with the script face for text in an Indian script', () => {
    expect(textFont('Booking (बुकिंग)')).toEqual(['PDF Devanagari', PDF_SANS]);
  });

  it('inherits the page face for Latin text', () => {
    expect(textFont('On completion of plinth')).toBeUndefined();
  });
});

describe('fitWords', () => {
  it('leaves text that fits alone', () => {
    expect(fitWords('On completion of the 4th slab', 99, 8)).toBe('On completion of the 4th slab');
  });

  it('breaks a word too wide for the box after a separator, keeping every character', () => {
    const ref = 'Demand-letter-ref-DL/2026/04/4512-tower-B-slab-14-podium';
    const out = fitWords(ref, 99, 8);
    expect(out.replace(/\n/g, '')).toBe(ref);
    const lines = out.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    // Every line but the last ends on a separator, so the pieces read as the reference.
    for (const line of lines.slice(0, -1)) expect(line).toMatch(/[/\-_.]$/);
  });

  it('cuts a word with no separators where it has to', () => {
    const out = fitWords('A'.repeat(60), 99, 8);
    expect(out.replace(/\n/g, '')).toBe('A'.repeat(60));
    expect(out.split('\n').length).toBeGreaterThan(1);
  });

  it('never cuts a word in an Indian script, whose letters join', () => {
    const word = 'बुकिंगराशिस्टांपशुल्कपंजीकरणशुल्कबुकिंगराशि';
    expect(fitWords(word, 40, 8)).toBe(word);
  });
});
