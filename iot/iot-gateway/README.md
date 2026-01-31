# IoT Gateway 

Tato část projektu obsahuje návrh / implementaci IoT gateway běžící v cloudu.
Gateway slouží jako ingest vrstva pro data z IoT node (ESP32) a předává je do backendu.

## Role gateway
- přijímá telemetrii z IoT node (HTTP endpoint / MQTT broker)
- ověřuje zařízení (token)
- normalizuje data a forwarduje do backendu / databáze
- loguje chyby a odmítnuté požadavky

## Komunikace
- Node -> Gateway: HTTPS (POST /telemetry)
- Gateway -> Backend: interní REST API (nebo stejná služba)

## Deploy
Gateway je plánovaná jako cloud service.
