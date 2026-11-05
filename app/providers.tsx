"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { isUnauthenticated } from "@/lib/api";
import { meQueryKey } from "@/lib/auth";
import { ThemeSync } from "@/lib/theme";

function createQueryClient() {
  // 세션이 끊겨 어떤 요청이든 401이 나면 사용자 정보를 다시 확인한다.
  // 그 요청도 401이 되면 AuthGate가 로그인 화면으로 보낸다.
  // 사용자 정보 요청 자신의 401은 제외한다(다시 확인하면 무한 반복된다).
  const onError = (error: unknown) => {
    if (isUnauthenticated(error)) void client.invalidateQueries({ queryKey: meQueryKey });
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== meQueryKey[0] || query.queryKey[1] !== meQueryKey[1]) onError(error);
      },
    }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) => !isUnauthenticated(error) && count < 2,
      },
    },
  });
  return client;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <ThemeSync />
      {children}
    </QueryClientProvider>
  );
}
