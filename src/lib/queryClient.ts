import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,   // 5 minutes — data considered fresh
      gcTime: 1000 * 60 * 15,     // 15 minutes — keep in cache
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})
