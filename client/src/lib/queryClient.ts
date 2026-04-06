import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Debug: Log env var at module load
const rawEnvVar = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_API_URL : undefined;
console.log("[DEBUG] Raw VITE_API_URL:", rawEnvVar);

// Use VITE_API_URL env var (set on Vercel) or fallback to relative path
const API_BASE = rawEnvVar || "";

// Ensure API_BASE ends with / for proper URL construction
const API_BASE_URL = API_BASE ? API_BASE.replace(/\/$/, '') : "";

console.log("[DEBUG] API_BASE:", API_BASE);
console.log("[DEBUG] API_BASE_URL:", API_BASE_URL);

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
  // Ensure proper URL construction
  const fullUrl = API_BASE_URL ? `${API_BASE_URL}${url}` : url;
  console.log("[DEBUG] apiRequest fullUrl:", fullUrl, "from API_BASE_URL:", API_BASE_URL, "and url:", url);
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
    // Ensure proper URL construction - queryKey like ["/api/routes"]
    const path = queryKey.join("/");
    const fullUrl = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
    console.log("[DEBUG] getQueryFn fullUrl:", fullUrl, "path:", path, "API_BASE_URL:", API_BASE_URL);
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
