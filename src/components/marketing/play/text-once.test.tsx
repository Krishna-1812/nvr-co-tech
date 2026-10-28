import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Letters } from './Letters';
import { Odometer } from './Odometer';

/**
 * What a crawler reads of a heading or a figure is its text, and the letters
 * and the rolling digits are drawn by CSS from data attributes so that text
 * holds the words once. Written into the boxes, a heading read as "Voucher
 * DeskVoucher Desk" and ₹1,48,150 as twenty digits per column.
 */
const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('the text a page gives a crawler', () => {
  it('holds a lettered heading once', () => {
    expect(text(renderToStaticMarkup(<Letters text="Voucher Desk" />)).trim()).toBe('Voucher Desk');
  });

  it('holds a rolling figure once, with no strip of digits', () => {
    expect(text(renderToStaticMarkup(<Odometer value="₹1,48,150" roll="none" />))).toBe('₹1,48,150');
  });

  it('still carries every letter and digit for the drawing', () => {
    const html = renderToStaticMarkup(<Letters text="Desk" />);
    expect([...html.matchAll(/data-ch="(.)"/g)].map((m) => m[1]).join('')).toBe('Desk');
  });
});
