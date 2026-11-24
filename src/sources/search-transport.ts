export type SearchRequest = { url: string; init: { method: string; headers: Record<string, string>; body?: string; credentials: 'omit' } };
export type SearchResponse = Pick<Response, 'ok' | 'status' | 'url' | 'headers' | 'text'>;

// Native apps request sites directly. Web uses the same-origin API implementation.
export function fetchSearchResponse(request: SearchRequest, signal: AbortSignal): Promise<SearchResponse> {
  return fetch(request.url, { ...request.init, signal });
}
