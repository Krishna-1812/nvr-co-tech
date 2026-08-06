import { renderToBuffer } from '@react-pdf/renderer';
import { ReconDocument } from './ReconDocument';
import type { ReconResult } from '../types';

/**
 * The statement as a PDF buffer. Server only.
 *
 * A one-function module so the route handler that calls it stays free of JSX,
 * matching how the voucher PDF is wired. Route files are the wrong place for a
 * component tree.
 */
export function renderReconPdf(result: ReconResult, preparedBy: string): Promise<Buffer> {
  return renderToBuffer(<ReconDocument result={result} preparedBy={preparedBy} />);
}
