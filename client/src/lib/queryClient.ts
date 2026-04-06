import { QueryClient, QueryFunction } from "@tanstack/react-query";

// HARD-CODED FIX: Always use the Render backend URL
// The env var approach wasn't working due to Vite build issues
const API_BASE_URL = "https://cota-tracker.onrender.com";

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
  // Ensure URL always has proper format: base + path
  // url comes in as "/api/alerts", so we concatenate directly
  const fullUrl = `${API_BASE_URL}${url}`;
  console.log("[API Request]", fullUrl);
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
    // Ensure URL always has proper format: base + path
    const fullUrl = `${API_BASE_URL}${path}`;
    console.log("[API Query]", fullUrl, "from path:", path);
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
