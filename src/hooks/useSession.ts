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
 * Hides write controls from a viewer. Until the role is known nothing is
 * hidden; the server's write guard is what refuses, this only spares a click.
 */
export function useCanWrite(): boolean {
  const { data: session } = useSession();
  return session?.role !== 'VIEWER';
}
