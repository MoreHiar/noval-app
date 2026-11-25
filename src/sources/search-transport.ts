import { createWashaiTransport } from './washai-transport';

export type SearchRequest = { url: string; init: { method: string; headers: Record<string, string>; body?: string; credentials: 'omit' } };
export type SearchResponse = Pick<Response, 'ok' | 'status' | 'url' | 'headers' | 'text'>;

// Native requests go directly to sites, with a browser session for Washai challenges.
const transport = createWashaiTransport((request, signal) => {
  return fetch(request.url, { ...request.init, signal });
});

export const fetchSearchResponse: (request: SearchRequest, signal: AbortSignal) => Promise<SearchResponse> = transport;
