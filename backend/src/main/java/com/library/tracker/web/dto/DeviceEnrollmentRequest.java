package com.library.tracker.web.dto;

/**
 * Общая часть входа и регистрации: запомнить ли устройство. Интерфейс, а не общий предок, —
 * {@link AuthRequest} и {@link RegisterRequest} расходятся в требованиях к паролю, и сводить их
 * в одну иерархию ради трёх полей значило бы связать эти требования между собой.
 */
public interface DeviceEnrollmentRequest {

    boolean isRememberDevice();

    String getDeviceFingerprint();

    String getDeviceName();
}
