import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, List, Popconfirm, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, LaptopOutlined } from '@ant-design/icons';
import {
  TrustedDevice,
  fetchTrustedDevices,
  revokeAllTrustedDevices,
  revokeTrustedDevice
} from '@/entities/auth/api/authApi';
import { getDeviceFingerprint } from '@/shared/lib/deviceFingerprint';
import { formatDateTime } from '@/shared/lib/date';
import { useRequestError } from '@/shared/lib/errors';

/**
 * Доверенные устройства: где вход происходит без пароля.
 *
 * Список нужен не для красоты: доверие живёт месяцами и переживает выход из системы, поэтому
 * должно быть место, где видно, скольким браузерам оно выдано, и откуда его можно снять — с
 * забытого в поездке ноутбука или со всех сразу.
 */
export const DevicesCard: React.FC = () => {
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fingerprint, setFingerprint] = useState<string | undefined>();

  const load = useCallback(
    async (deviceFingerprint?: string) => {
      setLoading(true);
      try {
        setDevices(await fetchTrustedDevices(deviceFingerprint));
      } catch (error) {
        showRequestError(error, 'Не удалось загрузить список устройств');
      } finally {
        setLoading(false);
      }
    },
    [showRequestError]
  );

  useEffect(() => {
    let cancelled = false;
    void getDeviceFingerprint().then((value) => {
      if (cancelled) {
        return;
      }
      setFingerprint(value);
      void load(value);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const revoke = async (device: TrustedDevice) => {
    try {
      await revokeTrustedDevice(device.id, fingerprint);
      setDevices((current) => current.filter((item) => item.id !== device.id));
      message.success(device.current ? 'Это устройство больше не доверенное' : 'Устройство отключено');
    } catch (error) {
      showRequestError(error, 'Не удалось отключить устройство');
    }
  };

  const revokeAll = async () => {
    try {
      await revokeAllTrustedDevices();
      setDevices([]);
      message.success('Быстрый вход отключён везде');
    } catch (error) {
      showRequestError(error, 'Не удалось отключить устройства');
    }
  };

  return (
    <Card
      title="Быстрый вход"
      extra={
        devices.length > 0 && (
          <Popconfirm
            title="Отключить везде?"
            description="На всех устройствах снова понадобится пароль."
            okText="Отключить"
            cancelText="Отмена"
            onConfirm={revokeAll}
          >
            <Button size="small" danger>
              Отключить везде
            </Button>
          </Popconfirm>
        )
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Эти устройства входят без пароля. Доверие переживает выход из системы — с чужого или
        потерянного устройства его нужно снять здесь.
      </Typography.Paragraph>

      <List
        loading={loading}
        locale={{
          emptyText: 'Пока ни одного: отметьте «запомнить устройство» при следующем входе'
        }}
        dataSource={devices}
        renderItem={(device) => (
          <List.Item
            actions={[
              <Popconfirm
                key="revoke"
                title={device.current ? 'Забыть это устройство?' : 'Отключить устройство?'}
                description="Войти с него снова можно будет только с паролем."
                okText="Отключить"
                cancelText="Отмена"
                onConfirm={() => revoke(device)}
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ]}
          >
            <List.Item.Meta
              avatar={<LaptopOutlined style={{ fontSize: 18 }} />}
              title={
                <Space size={8} wrap>
                  {device.label}
                  {device.current && (
                    <Tag color="success" bordered={false}>
                      это устройство
                    </Tag>
                  )}
                </Space>
              }
              description={
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {`Последний вход: ${formatDateTime(device.lastUsedAt)}`}
                  {device.lastIp ? ` · ${device.lastIp}` : ''}
                </Typography.Text>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};
