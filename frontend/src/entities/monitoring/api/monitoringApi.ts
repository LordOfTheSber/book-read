import { httpClient } from '@/shared/api/httpClient';
import { MonitoringMetrics, MonitoringSettings } from '@/shared/types/library';

export const fetchMonitoringMetrics = async (): Promise<MonitoringMetrics> => {
  const { data } = await httpClient.get<MonitoringMetrics>('/monitoring/metrics');
  return data;
};

export const updateMonitoringMetricsEnabled = async (enabled: boolean): Promise<void> => {
  await httpClient.put('/monitoring/metrics', { enabled });
};

export const updateMonitoringSettings = async (
  settings: Pick<MonitoringSettings, 'pingIntervalSeconds' | 'pingPath'>
): Promise<MonitoringSettings> => {
  const { data } = await httpClient.put<MonitoringSettings>('/monitoring/settings', settings);
  return data;
};
