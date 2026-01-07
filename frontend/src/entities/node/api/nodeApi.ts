import { httpClient } from '@/shared/api/httpClient';
import { NodeMemoryDetail, SystemNode } from '@/shared/types/library';

export const fetchNodes = async (): Promise<SystemNode[]> => {
  const { data } = await httpClient.get<SystemNode[]>('/nodes');
  return data;
};

export const fetchNodeById = async (nodeId: string): Promise<SystemNode> => {
  const { data } = await httpClient.get<SystemNode>(`/nodes/${nodeId}`);
  return data;
};

export const fetchNodeMemoryDetail = async (nodeId: string): Promise<NodeMemoryDetail> => {
  const { data } = await httpClient.get<NodeMemoryDetail>(`/nodes/${nodeId}/memory`);
  return data;
};

export const downloadNodeLogs = async (nodeId: string): Promise<void> => {
  const response = await httpClient.get(`/nodes/${nodeId}/logs`, {
    responseType: 'blob'
  });

  const blob = new Blob([response.data], { type: 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const contentDisposition = response.headers['content-disposition'];
  let filename = `node-${nodeId}-logs.log`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
