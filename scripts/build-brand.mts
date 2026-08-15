/**
 * Every brand raster, from the one master in src/lib/brand/mark.ts.
 *
 * Run with `npm run brand:icons` after changing the mark. The outputs are
 * committed, because a favicon has to exist before the app boots and building
 * it at request time would put sharp on the serving path for no reason.
 *
 * sharp comes in with Next rather than as a dependency of ours, which is fine
 * for a script that only runs by hand.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { markSvg } from '../src/lib/brand/mark';

const root = process.cwd();
const app = join(root, 'src', 'app');
const brand = join(root, 'public', 'brand');
mkdirSync(brand, { recursive: true });

const mark = markSvg();

const png = (svg: string, size: number) =>
  sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/**
 * An .ico is a six byte header, sixteen bytes per entry, then the payloads,
 * which since Vista may be PNG. sharp cannot write the container and it is not
 * worth a dependency, so it is assembled here.
 */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const written: string[] = [];
const put = (path: string, data: Buffer | string) => {
  writeFileSync(path, data);
  written.push(path.replace(root, '').replace(/\\/g, '/').replace(/^\//, ''));
};

// One mark, everywhere. icon.svg is what a modern browser actually shows in a
// tab; the .ico below is for the ones that do not take SVG. Both keep their
// transparent ground, so the bird is round in a tab rather than sitting on a
// plate the shape of the file.
put(join(app, 'icon.svg'), mark);
put(join(brand, 'logo-mark.svg'), mark);

const at: Record<number, Buffer> = {};
for (const size of [16, 32, 48, 180, 192, 512]) at[size] = await png(mark, size);

put(join(app, 'favicon.ico'), ico([16, 32, 48].map((size) => ({ size, data: at[size] }))));
put(join(app, 'apple-icon.png'), at[180]);
put(join(brand, 'icon-192.png'), at[192]);
put(join(brand, 'icon-512.png'), at[512]);
put(join(brand, 'logo-mark-1024.png'), await png(mark, 1024));

console.log(`Wrote ${written.length} files:`);
for (const path of written) console.log(`  ${path}`);
