# IoT Gateway API Specification

## Endpoint
**POST /telemetry**

Endpoint pro příjem telemetrických dat z IoT zařízení (aktuálně: senzor vlhkosti půdy).

---

## Headers
- **Authorization**: `Bearer <device_token>`
- **Content-Type**: `application/json`

---

## Request Body (aktuální verze)
```json
{
  "deviceId": "string",
  "timestampMs": 123456,
  "soilMoisture": 42
}
