import type { ChatRequest, ChatResponsePayload } from '../types/api';
import type { DatasetSummary, DatasetAuditReport, CleaningResult, CleaningPlan } from '../types/dataset';

const BASE_URL = '/api';

export async function fetchDatasets(): Promise<DatasetSummary[]> {
  const res = await fetch(`${BASE_URL}/datasets`);
  if (!res.ok) throw new Error(`Failed to fetch datasets: ${res.statusText}`);
  const data = await res.json();
  return data.datasets || [];
}

export async function uploadDataset(file: File, datasetName?: string): Promise<{ dataset_id: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (datasetName) {
    formData.append('dataset_name', datasetName);
  }

  const res = await fetch(`${BASE_URL}/datasets/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    dataset_id: data.data?.dataset_id || file.name.split('.')[0],
    message: data.message
  };
}

export async function fetchAuditReport(datasetId: string, refresh = false): Promise<DatasetAuditReport> {
  const url = `${BASE_URL}/datasets/${datasetId}/audit${refresh ? '?refresh=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audit failed: ${res.statusText}`);
  const data = await res.json();
  return data.data;
}

export async function fetchCleaningPlan(datasetId: string): Promise<CleaningPlan> {
  const res = await fetch(`${BASE_URL}/datasets/${datasetId}/cleaning-plans`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to create cleaning plan: ${res.statusText}`);
  const data = await res.json();
  return data.data;
}

export async function cleanDataset(datasetId: string): Promise<CleaningResult> {
  const res = await fetch(`${BASE_URL}/datasets/${datasetId}/clean`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Cleaning failed: ${res.statusText}`);
  const data = await res.json();
  return data.data;
}

export async function executeApprovedCleaning(
  datasetId: string,
  approvedIds?: string[],
  description?: string
): Promise<CleaningResult> {
  const res = await fetch(`${BASE_URL}/datasets/${datasetId}/cleaning-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approved_recommendation_ids: approvedIds,
      target_version_description: description
    })
  });
  if (!res.ok) throw new Error(`Cleaning execution failed: ${res.statusText}`);
  const data = await res.json();
  return data.data;
}

export async function fetchDatasetVersions(datasetId: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE_URL}/datasets/${datasetId}/versions`);
  if (!res.ok) throw new Error(`Failed to fetch versions: ${res.statusText}`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchDatasetPreview(datasetId: string, limit = 50): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/datasets/${datasetId}/preview?limit=${limit}`);
  if (!res.ok) throw new Error(`Preview failed: ${res.statusText}`);
  const data = await res.json();
  return data.data;
}

export async function executeChatSync(req: ChatRequest): Promise<ChatResponsePayload> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Chat execution failed: ${res.statusText}`);
  }

  return await res.json();
}

export async function fetchSystemAuditLogs(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE_URL}/audit`);
  if (!res.ok) throw new Error(`Failed to fetch audit logs: ${res.statusText}`);
  const data = await res.json();
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

export async function downloadDatasetExport(datasetId: string, options: ExportDatasetOptions = {}): Promise<string> {
  const url = getDatasetExportUrl(datasetId, options);
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Export failed: ${res.statusText}`);
  }

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

export async function deleteDataset(datasetId: string): Promise<{ status: string; dataset_id: string; message: string }> {
  const res = await fetch(`${BASE_URL}/datasets/${encodeURIComponent(datasetId)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete dataset: ${res.statusText}`);
  }
  return await res.json();
}


