import { NextRequest, NextResponse } from 'next/server';
import { processExcelExtractionWebhook } from '@/server/webhooks/excelExtractionWebhook';

// Authentication is the HMAC token in the query string, verified inside the
// processor against userId + timestamp.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const result = await processExcelExtractionWebhook(payload, query);
  return NextResponse.json(result.body, { status: result.status });
}
