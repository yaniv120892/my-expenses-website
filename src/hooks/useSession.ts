import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { MeResponse } from '@/shared/types/household';

export function useSession() {
  return useQuery<MeResponse>({
    queryKey: ['session'],
    queryFn: async () => (await api.get<MeResponse>('/api/auth/me')).data,
    staleTime: 5 * 60_000,
  });
}

/**
 * Shows a write control only once the role is known to allow it, so a viewer
 * never sees one; the server's write guard is what refuses, this only spares a
 * click.
 */
export function useCanWrite(): boolean {
  const { data: session } = useSession();
  return session !== undefined && session.role !== 'VIEWER';
}

/** For read-only copy, which waits for the role as write controls do. */
export function useIsViewer(): boolean {
  const { data: session } = useSession();
  return session?.role === 'VIEWER';
}
