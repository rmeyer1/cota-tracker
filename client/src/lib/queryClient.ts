import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Use VITE_API_URL env var (set on Vercel) or fallback to relative path
const API_BASE = (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_URL) || "";

// Ensure API_BASE ends with / for proper URL construction
const API_BASE_URL = API_BASE ? API_BASE.replace(/\/$/, '') : "";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = API_BASE_URL ? `${API_BASE_URL}${url}` : url;
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let path = queryKey.join("/");
    // Ensure path starts with / for proper URL construction
    if (!path.startsWith("/")) {
      path = "/" + path;
    }
    const fullUrl = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
    const res = await fetch(fullUrl);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
