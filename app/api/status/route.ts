import { providerStatus } from '@/lib/config';
export function GET() {
  return Response.json(providerStatus(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
