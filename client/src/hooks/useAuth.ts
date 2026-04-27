import { useQuery } from '@tanstack/react-query';

interface User { id: number; email: string; name: string; }

export function useAuth() {
  const { data, isLoading } = useQuery<{ user: User | null }>({
    queryKey: ['auth'],
    queryFn: () => fetch('/auth/me', { credentials: 'include' }).then((r) => r.json()),
    retry: false,
  });
  return { user: data?.user ?? null, isLoading };
}
