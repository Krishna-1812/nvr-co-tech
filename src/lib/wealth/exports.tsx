import { memberName, type WealthRecord } from './model';

/**
 * The files Wealth Tracker can make, all drawn in the browser.
 *
 * Imported only when somebody asks for a file, so the PDF renderer and the
 * spreadsheet library (a megabyte between them) are never part of the screen's
 * own load.
 */
export async function exportFile(
  kind: 'pdf-full' | 'pdf-masked' | 'excel',
  record: WealthRecord,
  today: string,
): Promise<{ blob: Blob; name: string }> {
  const who = fileBase(memberName(record.profile, 'self'));
  if (kind === 'excel') {
    const [XLSX, { buildWealthWorkbook }] = await Promise.all([import('xlsx'), import('./workbook')]);
    const book = buildWealthWorkbook(record, today, XLSX);
    const data = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return {
      blob: new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      name: `${who} - wealth record ${today}.xlsx`,
    };
  }
  const [{ pdf }, { WealthRecordDocument }] = await Promise.all([import('@react-pdf/renderer'), import('./report')]);
  const masked = kind === 'pdf-masked';
  const blob = await pdf(<WealthRecordDocument record={record} today={today} masked={masked} />).toBlob();
  return { blob, name: `${who} - wealth record ${today}${masked ? ' (numbers hidden)' : ''}.pdf` };
}

/** Keeps every script's letters, so a Hindi name is not emptied out of a file name. */
function fileBase(name: string): string {
  const clean = name.replace(/[^\p{L}\p{M}\p{N}\- ]+/gu, '').trim();
  return clean || 'My';
}
