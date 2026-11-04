import type { ChatRequest, ChatResponsePayload } from '../types/api';
import type {
  DatasetSummary,
  DatasetAuditReport,
  CleaningResult,
  CleaningPlan,
  CorrelationReport,
  DriverAnalysisReport
} from '../types/dataset';

const BASE_URL = '/api';

/** Default request timeout. Long-running operations override it explicitly. */
const DEFAULT_TIMEOUT_MS = 30_000;
const LONG_TIMEOUT_MS = 180_000;

/** Safe (idempotent) requests are retried on network failures and gateway errors. */
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

type AuthTokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>;

let authTokenGetter: AuthTokenGetter | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthTokenGetter(getter: AuthTokenGetter | null) {
  authTokenGetter = getter;
}

/** Registers a callback fired when the server rejects a request with 401 after one token refresh. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export async function getAuthToken(skipCache = false): Promise<string | null> {
  if (!authTokenGetter) return null;
  try {
    return await authTokenGetter(skipCache ? { skipCache: true } : undefined);
  } catch {
    return null;
  }
}

/** Error thrown for any failed API call. `message` is safe to show to users. */
export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: 'http' | 'network' | 'timeout' | 'aborted';

  constructor(message: string, kind: ApiError['kind'], status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

function describeStatus(status: number): string {
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'You do not have permission to do this.';
  if (status === 404) return 'The requested item was not found.';
  if (status === 413) return 'The file is too large to upload.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return 'The server ran into a problem. Try again in a moment.';
  return `The request failed (HTTP ${status}).`;
}

/** Extracts a readable message from a FastAPI-style error body, falling back to a status description. */
export async function readErrorMessage(res: Response, fallbackPrefix?: string): Promise<string> {
  let detail: unknown;
  try {
    const body = await res.clone().json();
    detail = body?.detail ?? body?.message ?? body?.error;
  } catch {
    // Body was not JSON.
  }

  let text: string | null = null;
  if (typeof detail === 'string' && detail.trim()) {
    text = detail.trim();
  } else if (Array.isArray(detail) && detail.length > 0) {
    // FastAPI validation errors: [{ loc, msg, type }]
    text = detail
      .map((d) => (typeof d?.msg === 'string' ? d.msg : null))
      .filter(Boolean)
      .join('; ');
  }

  const base = text || describeStatus(res.status);
  return fallbackPrefix && !text ? `${fallbackPrefix}. ${base}` : base;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RequestOptions extends RequestInit {
  /** Timeout for a single attempt. */
  timeoutMs?: number;
  /** Prefix for the user-facing message when the server gives no detail. */
  errorContext?: string;
}

/**
 * Single entry point for API calls. Adds the auth header, enforces a timeout,
 * refreshes the token once on 401, retries safe requests, and throws ApiError.
 */
async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, errorContext, signal: callerSignal, ...init } = options;
  const method = (init.method || 'GET').toUpperCase();
  const isSafe = method === 'GET' || method === 'HEAD';
  const maxAttempts = isSafe ? MAX_RETRIES + 1 : 1;

  let refreshedAfter401 = false;
  let forceFreshToken = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (callerSignal?.aborted) {
      throw new ApiError('The request was cancelled.', 'aborted');
    }

    const headers = new Headers(init.headers);
    const token = await getAuthToken(forceFreshToken);
    forceFreshToken = false;
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;

    let res: Response;
    try {
      res = await fetch(path, { ...init, headers, signal });
    } catch (err) {
      if (callerSignal?.aborted) {
        throw new ApiError('The request was cancelled.', 'aborted');
      }
      const timedOut = timeoutSignal.aborted;
      if (attempt < maxAttempts) {
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
      if (timedOut) {
        throw new ApiError(
          'The server took too long to respond. Check your connection and try again.',
          'timeout'
        );
      }
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      throw new ApiError(
        offline
          ? 'You are offline. Reconnect to continue.'
          : 'Could not reach the server. Check your connection and try again.',
        'network'
      );
    }

    if (res.status === 401 && !refreshedAfter401 && authTokenGetter) {
      // Token may have expired mid-session. Retry once with a token that bypasses the cache.
      // The extra attempt does not count against the retry budget for network errors.
      refreshedAfter401 = true;
      forceFreshToken = true;
      attempt--;
      continue;
    }

    if (res.status === 401) {
      unauthorizedHandler?.();
    }

    if (!res.ok) {
      if (RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
      throw new ApiError(await readErrorMessage(res, errorContext), 'http', res.status);
    }

    return res;
  }

  // Unreachable: the loop always returns or throws.
  throw new ApiError('The request failed.', 'network');
}

async function requestJson<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
  const res = await request(path, options);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('The server sent a response that could not be read.', 'http', res.status);
  }
}

const jsonBody = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

/** Authenticated fetch for callers that need the raw Response (no retry, timeout or error mapping). */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = await getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export async function fetchDatasets(): Promise<DatasetSummary[]> {
  const data = await requestJson<{ datasets?: DatasetSummary[] }>(`${BASE_URL}/datasets`, {
    errorContext: 'Could not load datasets'
  });
  return data.datasets || [];
}

export async function uploadDataset(
  file: File,
  datasetName?: string
): Promise<{ dataset_id: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (datasetName) {
    formData.append('dataset_name', datasetName);
  }

  const data = await requestJson<{ data?: { dataset_id?: string }; message: string }>(
    `${BASE_URL}/datasets/upload`,
    {
      method: 'POST',
      body: formData,
      timeoutMs: LONG_TIMEOUT_MS,
      errorContext: 'Upload failed'
    }
  );
  return {
    dataset_id: data.data?.dataset_id || file.name.split('.')[0],
    message: data.message
  };
}

export async function fetchAuditReport(datasetId: string, refresh = false): Promise<DatasetAuditReport> {
  const url = `${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/audit${refresh ? '?refresh=true' : ''}`;
  const data = await requestJson<{ data: DatasetAuditReport }>(url, {
    timeoutMs: LONG_TIMEOUT_MS,
    errorContext: 'Quality audit failed'
  });
  return data.data;
}

export async function fetchCleaningPlan(datasetId: string): Promise<CleaningPlan> {
  const data = await requestJson<{ data: CleaningPlan }>(
    `${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/cleaning-plans`,
    { method: 'POST', timeoutMs: LONG_TIMEOUT_MS, errorContext: 'Could not create a cleaning plan' }
  );
  return data.data;
}

export async function cleanDataset(datasetId: string): Promise<CleaningResult> {
  const data = await requestJson<{ data: CleaningResult }>(
    `${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/clean`,
    { method: 'POST', timeoutMs: LONG_TIMEOUT_MS, errorContext: 'Cleaning failed' }
  );
  return data.data;
}

export async function executeApprovedCleaning(
  datasetId: string,
  approvedIds?: string[],
  description?: string
): Promise<CleaningResult> {
  const data = await requestJson<{ data: CleaningResult }>(
    `${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/cleaning-runs`,
    {
      method: 'POST',
      ...jsonBody({
        approved_recommendation_ids: approvedIds,
        target_version_description: description
      }),
      timeoutMs: LONG_TIMEOUT_MS,
      errorContext: 'Cleaning could not be applied'
    }
  );
  return data.data;
}

export async function fetchDatasetVersions(datasetId: string): Promise<Record<string, unknown>[]> {
  const data = await requestJson<{ data?: Record<string, unknown>[] }>(
    `${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/versions`,
    { errorContext: 'Could not load dataset versions' }
  );
  return data.data || [];
}

export async function fetchDatasetPreview(datasetId: string, limit = 50): Promise<Record<string, unknown>> {
  const data = await requestJson<{ data: Record<string, unknown> }>(
    `${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/preview?limit=${limit}`,
    { errorContext: 'Could not load the data preview' }
  );
  return data.data;
}

export async function executeChatSync(req: ChatRequest): Promise<ChatResponsePayload> {
  return requestJson<ChatResponsePayload>(`${BASE_URL}/chat`, {
    method: 'POST',
    ...jsonBody(req),
    timeoutMs: LONG_TIMEOUT_MS,
    errorContext: 'The analysis could not run'
  });
}

export async function fetchSystemAuditLogs(): Promise<Record<string, unknown>[]> {
  const data = await requestJson<{ logs?: Record<string, unknown>[] }>(`${BASE_URL}/audit`, {
    errorContext: 'Could not load the audit log'
  });
  return data.logs || [];
}

export interface ExportDatasetOptions {
  format?: 'csv' | 'tsv' | 'json' | 'parquet';
  delimiter?: string;
  includeHeader?: boolean;
  bom?: boolean;
  version?: number;
  filename?: string;
}

export function getDatasetExportUrl(datasetId: string, options: ExportDatasetOptions = {}): string {
  const params = new URLSearchParams();
  if (options.format) params.set('format', options.format);
  if (options.delimiter) params.set('delimiter', options.delimiter);
  if (options.includeHeader !== undefined) params.set('include_header', String(options.includeHeader));
  if (options.bom !== undefined) params.set('bom', String(options.bom));
  if (options.version !== undefined) params.set('version', String(options.version));
  if (options.filename) params.set('filename', options.filename);

  const qs = params.toString();
  return `${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/export${qs ? `?${qs}` : ''}`;
}

export async function downloadDatasetExport(
  datasetId: string,
  options: ExportDatasetOptions = {}
): Promise<string> {
  const res = await request(getDatasetExportUrl(datasetId, options), {
    timeoutMs: LONG_TIMEOUT_MS,
    errorContext: 'Export failed'
  });

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;

  const disposition = res.headers.get('Content-Disposition');
  let filename = options.filename || `${datasetId}.${options.format || 'csv'}`;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/);
    if (match && match[1]) filename = match[1];
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);

  return filename;
}

export async function deleteDataset(
  datasetId: string
): Promise<{ status: string; dataset_id: string; message: string }> {
  return requestJson(`${BASE_URL}/datasets/${encodeURIComponent(datasetId)}`, {
    method: 'DELETE',
    errorContext: 'Could not delete the dataset'
  });
}

export async function renameDataset(
  datasetId: string,
  newName: string
): Promise<{ status: string; old_dataset_id: string; new_dataset_id: string; message: string }> {
  return requestJson(`${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/rename`, {
    method: 'POST',
    ...jsonBody({ new_name: newName }),
    errorContext: 'Could not rename the dataset'
  });
}

export async function fetchDatasetCorrelations(datasetId: string, maxColumns = 12): Promise<CorrelationReport> {
  const data = await requestJson<{ data: CorrelationReport }>(
    `${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/correlations?max_columns=${maxColumns}`,
    { timeoutMs: LONG_TIMEOUT_MS, errorContext: 'Could not compute correlations' }
  );
  return data.data;
}

export async function fetchDriverAnalysis(
  datasetId: string,
  metricCol?: string,
  dimensionCol?: string,
  limit = 15
): Promise<DriverAnalysisReport> {
  const data = await requestJson<{ data: DriverAnalysisReport }>(`${BASE_URL}/analytics/drivers`, {
    method: 'POST',
    ...jsonBody({
      dataset_id: datasetId,
      metric_col: metricCol,
      dimension_col: dimensionCol,
      limit
    }),
    timeoutMs: LONG_TIMEOUT_MS,
    errorContext: 'Could not analyze drivers'
  });
  return data.data;
}
