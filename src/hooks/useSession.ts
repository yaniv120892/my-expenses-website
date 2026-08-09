import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export interface Session {
  userId: string;
  email: string | null;
}

export function useSession() {
  return useQuery<Session>({
    queryKey: ['session'],
    queryFn: async () => (await api.get<Session>('/api/auth/me')).data,
    staleTime: 5 * 60_000,
  });
}
