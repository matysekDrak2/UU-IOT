#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <time.h>

// =====================================
// BACKEND
// =====================================
// Base URL backendu (včetně /api/V1)
const char* API_BASE = "http://10.0.0.245:8080/api/V1";

// Endpoints, které si ESP volá (musí existovat na backendu)
const char* ENDPOINT_REGISTER  = "/node";   // PUT (bez auth), body: { userId, deviceId, name }
const char* ENDPOINT_HEARTBEAT = "/node/heartbeat";  // PUT  (node-auth), body: { timestamp, uptimeSec, rssi }

// =====================================
// TIME (NTP)
// =====================================
const char* NTP_SERVER_1 = "pool.ntp.org";
const char* NTP_SERVER_2 = "time.nist.gov";
const long  GMT_OFFSET_SEC = 0;      // UTC
const int   DAYLIGHT_OFFSET_SEC = 0; // UTC

// =====================================
// SENSOR
// =====================================
const int SOIL_PIN = 4;     // ADC pin
int CAL_DRY = 3645;
int CAL_WET = 1215;

// =====================================
// TIMING
// =====================================
//const unsigned long SEND_INTERVAL_MS       = 15UL * 60UL * 1000UL; // 15 min (produkce)
const unsigned long SEND_INTERVAL_MS       = 10UL * 1000UL;  // 10 s (demo)

const unsigned long WIFI_RETRY_MS          = 10UL * 1000UL;
const unsigned long WIFI_FAIL_MAX_MS       = 2UL * 60UL * 1000UL;
const unsigned long NTP_RESYNC_MS          = 6UL * 60UL * 60UL * 1000UL;

const unsigned long HEARTBEAT_INTERVAL_MS  = 60UL * 1000UL; // 60 s
const unsigned long PROVISION_RETRY_MS     = 20UL * 1000UL; // 20 s (když backend nedostupný)

// =====================================
// GLOBALS
// =====================================
WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

const byte DNS_PORT = 53;
const char* AP_PASS = "12345678"; // WPA2

bool isPairingMode = false;
String apSsid;

unsigned long lastSend = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastWifiRetry = 0;
unsigned long wifiDownSince = 0;
unsigned long lastNtpSync = 0;

unsigned long lastProvisionAttempt = 0;

// =====================================
// SENSOR HELPERS
// =====================================
int readSoilRaw(uint8_t samples = 8) {
  long acc = 0;
  for (uint8_t i = 0; i < samples; i++) {
    acc += analogRead(SOIL_PIN);
    delay(2);
  }
  return (int)(acc / samples);
}

int rawToPercent(int raw) {
  float pct = ((float)(CAL_DRY - raw) * 100.0f) / (float)(CAL_DRY - CAL_WET);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (int)pct;
}

int readMoisturePercent() {
  return rawToPercent(readSoilRaw());
}

// =====================================
// PREFERENCES (NVS)
// =====================================
String loadPref(const char* key) {
  prefs.begin("iot", true);
  String v = prefs.getString(key, "");
  prefs.end();
  return v;
}

void savePref(const char* key, const String& value) {
  prefs.begin("iot", false);
  prefs.putString(key, value);
  prefs.end();
}

bool hasWifiCreds() { return loadPref("ssid").length() > 0; }
bool hasUserId()    { return loadPref("userId").length() > 0; }

bool hasNodeToken() { return loadPref("nodeToken").length() > 0; }
bool hasPotId()     { return loadPref("potId").length() > 0; }

String getSsid()     { return loadPref("ssid"); }
String getPass()     { return loadPref("pass"); }
String getUserId()   { return loadPref("userId"); }

String getNodeToken(){ return loadPref("nodeToken"); }
String getPotId()    { return loadPref("potId"); }

// =====================================
// TIME (NTP)
// =====================================
bool initTimeWithNTP(unsigned long timeoutMs = 15000) {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);

  Serial.print("[TIME] Syncing NTP");
  unsigned long t0 = millis();
  time_t now = time(nullptr);

  while (now < 1700000000 && (millis() - t0) < timeoutMs) {
    delay(300);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println();

  if (now < 1700000000) {
    Serial.println("[TIME] NTP sync FAILED");
    return false;
  }

  Serial.println("[TIME] NTP synced OK");
  lastNtpSync = millis();
  return true;
}

bool timeIsValid() {
  return time(nullptr) >= 1700000000;
}

String isoTimestampUtc() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "";
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// =====================================
// HTML (PAIRING UI)
// =====================================
String htmlHeader(const String& title) {
  String s = "<!doctype html><html><head><meta charset='utf-8'>";
  s += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  s += "<title>" + title + "</title>";
  s += "<style>body{font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#222}"
       "h1{color:#4caf50} .card{padding:1rem 1.25rem;border:1px solid #eee;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.06)}"
       "label{display:block;margin:.75rem 0 .25rem} input{width:100%;padding:.6rem;border:1px solid #ddd;border-radius:10px}"
       "button{margin-top:1rem;padding:.7rem 1rem;border:0;border-radius:10px;background:#4caf50;color:white;font-weight:600;cursor:pointer}"
       "small{color:#555}</style></head><body>";
  return s;
}
String htmlFooter() { return "</body></html>"; }

String htmlPairingPage(const String& msg = "") {
  String currentSsid = loadPref("ssid");
  String currentUserId = loadPref("userId");

  String s = htmlHeader("Pairing");
  s += "<h1>🔧 Smart Garden – Pairing</h1>";
  s += "<div class='card'>";
  if (msg.length()) s += "<p><b>" + msg + "</b></p>";

  s += "<p><small>Vyplň domácí Wi-Fi a User ID. Po uložení se zařízení restartuje a samo si vyžádá token + potId z backendu.</small></p>";

  s += "<form method='POST' action='/save'>";

  s += "<label>User ID</label>";
  s += "<input name='userId' placeholder='UUID uživatele' value='" + currentUserId + "' required>";

  s += "<label>Wi-Fi SSID</label>";
  s += "<input name='ssid' placeholder='např. O2-Internet-xxx' value='" + currentSsid + "' required>";

  s += "<label>Wi-Fi heslo</label>";
  s += "<input name='pass' type='password' placeholder='heslo k Wi-Fi'>";

  s += "<button type='submit'>Uložit a restartovat</button>";
  s += "</form>";

  s += "<hr style='margin:1rem 0;border:none;border-top:1px solid #eee'>";
  s += "<form method='POST' action='/reset'>";
  s += "<button style='background:#999'>Reset uložených dat</button>";
  s += "</form>";

  s += "</div>";
  s += htmlFooter();
  return s;
}

String htmlNormalPage() {
  int pct = readMoisturePercent();

  String s = htmlHeader("Smart Garden");
  s += "<h1>Smart Garden</h1>";
  s += "<div class='card'>";
  s += "<h2>Vlhkost půdy: " + String(pct) + "%</h2>";

  s += "<p><small>";
  s += "Wi-Fi: " + String(WiFi.status() == WL_CONNECTED ? "připojeno" : "nepřipojeno");
  s += " · IP: " + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : String("-"));
  s += " · Čas: " + String(timeIsValid() ? isoTimestampUtc() : String("NTP neplatný"));
  s += "</small></p>";

  s += "<p><small>";
  s += "userId: " + getUserId();
  s += "<br>nodeToken: " + String(hasNodeToken() ? "OK" : "chybí");
  s += " · potId: " + String(hasPotId() ? "OK" : "chybí");
  s += "</small></p>";

  s += "<p><a href='/pair'>Otevřít pairing</a></p>";
  s += "</div>";
  s += htmlFooter();
  return s;
}

// =====================================
// MODE SWITCH HELPERS
// =====================================
void stopServices() {
  server.stop();
  dnsServer.stop();
}

void sendCaptiveRedirect() {
  server.sendHeader("Location", String("http://") + WiFi.softAPIP().toString() + "/");
  server.send(302, "text/plain", "Redirecting to captive portal");
}

// =====================================
// HTTP HANDLERS
// =====================================
void handleRoot() {
  if (isPairingMode) server.send(200, "text/html; charset=utf-8", htmlPairingPage());
  else server.send(200, "text/html; charset=utf-8", htmlNormalPage());
}

void handlePairPage() {
  server.send(200, "text/html; charset=utf-8", htmlPairingPage());
}

void handleSave() {
  String ssid   = server.arg("ssid");   ssid.trim();
  String pass   = server.arg("pass");
  String userId = server.arg("userId"); userId.trim();

  if (ssid.length() == 0 || userId.length() == 0) {
    server.send(400, "text/html; charset=utf-8", htmlPairingPage("Chybí SSID nebo userId."));
    return;
  }

  savePref("ssid", ssid);
  savePref("pass", pass);
  savePref("userId", userId);

  // když měníš userId/Wi-Fi, smaž staré provisioned údaje
  savePref("nodeToken", "");
  savePref("potId", "");

  server.send(200, "text/html; charset=utf-8",
              htmlHeader("Saved") +
              "<h1>Uloženo</h1><div class='card'><p>Konfigurace uložena. Restartuji…</p></div>" +
              htmlFooter());

  delay(1200);
  ESP.restart();
}

void handleReset() {
  prefs.begin("iot", false);
  prefs.clear();
  prefs.end();

  server.send(200, "text/html; charset=utf-8",
              htmlHeader("Reset") +
              "<h1>🧹 Reset</h1><div class='card'><p>Smazáno. Restartuji…</p></div>" +
              htmlFooter());

  delay(1200);
  ESP.restart();
}

void handleCaptiveProbe() { sendCaptiveRedirect(); }

void handleNotFound() {
  if (isPairingMode) sendCaptiveRedirect();
  else server.send(404, "text/plain; charset=utf-8", "Not Found");
}

// =====================================
// WIFI
// =====================================
bool connectWifiFromPrefs() {
  String ssid = getSsid();
  String pass = getPass();
  if (ssid.length() == 0) return false;

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());

  Serial.print("[WiFi] Connecting to "); Serial.println(ssid);

  const uint32_t WIFI_TIMEOUT_MS = 15000;
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < WIFI_TIMEOUT_MS) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WiFi] Connected");
    Serial.print("[WiFi] IP: "); Serial.println(WiFi.localIP());

    // NTP sync (best effort)
    initTimeWithNTP();

    wifiDownSince = 0;
    lastWifiRetry = 0;
    return true;
  }

  Serial.println("[WiFi] FAILED");
  return false;
}

void ensureWifiConnected() {
  if (isPairingMode) return;

  if (WiFi.status() == WL_CONNECTED) {
    wifiDownSince = 0;
    if ((millis() - lastNtpSync) > NTP_RESYNC_MS) {
      initTimeWithNTP(8000);
    }
    return;
  }

  unsigned long now = millis();
  if (wifiDownSince == 0) wifiDownSince = now;

  if (now - lastWifiRetry >= WIFI_RETRY_MS) {
    lastWifiRetry = now;
    Serial.println("[WiFi] Lost -> retry connect");
    connectWifiFromPrefs();
  }

  if (now - wifiDownSince >= WIFI_FAIL_MAX_MS) {
    Serial.println("[WiFi] Offline too long -> switching to pairing");
    startPairingMode();
  }
}

// =====================================
// SIMPLE JSON STRING EXTRACTOR
// (for tiny responses like {"nodeToken":"...","potId":"..."})
// =====================================
String extractJsonString(const String& json, const String& key) {
  String pattern = "\"" + key + "\":";
  int i = json.indexOf(pattern);
  if (i < 0) return "";
  i += pattern.length();

  // skip spaces
  while (i < (int)json.length() && (json[i] == ' ')) i++;

  if (i >= (int)json.length() || json[i] != '\"') return "";
  i++; // after first quote

  int j = json.indexOf('\"', i);
  if (j < 0) return "";
  return json.substring(i, j);
}

// =====================================
// PROVISIONING (userId -> nodeToken + potId)
// =====================================
bool provisionFromBackend() {
  if (WiFi.status() != WL_CONNECTED) return false;

  String userId = getUserId();
  if (userId.length() == 0) return false;

  String url = String(API_BASE) + "/node"; // PUT /api/V1/node

  String deviceId = WiFi.macAddress();
  deviceId.replace(":", "");

  String body = "{";
  body += "\"userId\":\"" + userId + "\",";
  body += "\"deviceId\":\"" + deviceId + "\",";
  body += "\"name\":\"SmartGarden-" + deviceId.substring(deviceId.length() - 4) + "\"";
  body += "}";

  WiFiClient client;
  HTTPClient http;

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  Serial.println("[PROVISION] PUT " + url);
  Serial.println("[PROVISION] Body: " + body);

  int code = http.sendRequest("PUT", (uint8_t*)body.c_str(), body.length());
  Serial.print("[PROVISION] HTTP code: ");
  Serial.println(code);

  String resp = http.getString();
  if (resp.length()) {
    Serial.print("[PROVISION] Resp: ");
    Serial.println(resp);
  }

  http.end();

  if (code < 200 || code >= 300) return false;

  // backend returns { nodeId, token }
  String token = extractJsonString(resp, "token");
  if (token.length() == 0) {
    Serial.println("[PROVISION] Missing token in response");
    return false;
  }
  savePref("nodeToken", token);
  Serial.println("[PROVISION] Saved nodeToken");

  String potId = extractJsonString(resp, "potId");
  if (potId.length() == 0) {
    Serial.println("[PROVISION] Missing potId in response");
    return false;
  }
  savePref("potId", potId);
  Serial.println("[PROVISION] Saved potId");

  return true;

}

void ensureProvisioned() {
  if (hasNodeToken() && hasPotId()) return;
  if (!hasUserId()) return;
  if (WiFi.status() != WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastProvisionAttempt < PROVISION_RETRY_MS) return;
  lastProvisionAttempt = now;

  bool ok = provisionFromBackend();
  Serial.println(ok ? "[PROVISION] OK" : "[PROVISION] FAIL");
}

// =====================================
// HEARTBEAT (node-auth)
// =====================================
bool sendHeartbeatOnce() {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (!hasNodeToken()) return false;

  String token = getNodeToken();
  if (token.length() == 0) return false;

  String ts = isoTimestampUtc();
  if (ts.length() == 0) return false;

  String url = String(API_BASE) + String(ENDPOINT_HEARTBEAT);

  long rssi = WiFi.RSSI();
  unsigned long uptimeSec = millis() / 1000UL;

  String body = "{";
  body += "\"timestamp\":\"" + ts + "\",";
  body += "\"uptimeSec\":" + String(uptimeSec) + ",";
  body += "\"rssi\":" + String(rssi);
  body += "}";

  WiFiClient client;
  HTTPClient http;

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + token);

  Serial.println("[HEARTBEAT] PUT " + url);

  int code = http.sendRequest("PUT", (uint8_t*)body.c_str(), body.length());
  Serial.print("[HEARTBEAT] HTTP code: ");
  Serial.println(code);

  http.end();
  return (code >= 200 && code < 300);
}

// =====================================
// TELEMETRY (requires potId + nodeToken)
// =====================================
bool sendTelemetryOnce() {
  Serial.print("[TELEMETRY] potId: ");
  Serial.println(getPotId());

  if (WiFi.status() != WL_CONNECTED) return false;

  if (!hasPotId() || !hasNodeToken()) {
    Serial.println("[TELEMETRY] Missing potId/nodeToken -> skip");
    return false;
  }

  // ensure time
  if (!timeIsValid()) {
    Serial.println("[TELEMETRY] Time invalid -> trying NTP sync");
    initTimeWithNTP(8000);
    if (!timeIsValid()) {
      Serial.println("[TELEMETRY] Still no valid time -> skip send");
      return false;
    }
  }

  String potId = getPotId();
  String token = getNodeToken();

  int raw = readSoilRaw();
  int pct = rawToPercent(raw);
  Serial.printf("[SENSOR] raw=%d pct=%d (CAL_DRY=%d CAL_WET=%d)\n", raw, pct, CAL_DRY, CAL_WET);

  String url = String(API_BASE) + "/pot/" + potId + "/measurement";

  String ts = isoTimestampUtc();
  if (ts.length() == 0) return false;

  String body = "{";
  body += "\"timestamp\":\"" + ts + "\",";
  body += "\"value\":" + String(pct) + ",";
  body += "\"type\":\"moisture\"";
  body += "}";

  WiFiClient client;
  HTTPClient http;

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + token);

  Serial.println("[TELEMETRY] PUT " + url);

  int code = http.sendRequest("PUT", (uint8_t*)body.c_str(), body.length());
  Serial.print("[TELEMETRY] HTTP code: ");
  Serial.println(code);

  String resp = http.getString();
  if (resp.length()) {
    Serial.print("[TELEMETRY] Resp: ");
    Serial.println(resp);
  }

  http.end();
  return (code >= 200 && code < 300);
}

// =====================================
// MODES
// =====================================
void startPairingMode() {
  stopServices();
  isPairingMode = true;

  wifiDownSince = 0;
  lastWifiRetry = 0;

  String mac = WiFi.macAddress();
  mac.replace(":", "");
  apSsid = "SmartGarden-" + mac.substring(mac.length() - 4);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSsid.c_str(), AP_PASS);

  IPAddress ip = WiFi.softAPIP();
  Serial.println("[MODE] PAIRING (captive portal)");
  Serial.print("[PAIRING] SSID: "); Serial.println(apSsid);
  Serial.print("[PAIRING] PASS: "); Serial.println(AP_PASS);
  Serial.print("[PAIRING] IP: "); Serial.println(ip);

  dnsServer.start(DNS_PORT, "*", ip);

  server.on("/", handleRoot);
  server.on("/pair", handlePairPage);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/reset", HTTP_POST, handleReset);

  server.on("/generate_204", handleCaptiveProbe);               // Android
  server.on("/gen_204", handleCaptiveProbe);
  server.on("/hotspot-detect.html", handleCaptiveProbe);        // iOS
  server.on("/library/test/success.html", handleCaptiveProbe);  // iOS older
  server.on("/ncsi.txt", handleCaptiveProbe);                   // Windows

  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("[HTTP] Server running on port 80 (pairing)");
}

void startNormalMode() {
  stopServices();
  isPairingMode = false;

  Serial.println("[MODE] NORMAL");
  bool ok = connectWifiFromPrefs();
  if (!ok) {
    Serial.println("[MODE] WiFi connect failed -> pairing");
    startPairingMode();
    return;
  }

  server.on("/", handleRoot);
  server.on("/pair", handlePairPage);

  // allow save/reset also in normal mode
  server.on("/save", HTTP_POST, handleSave);
  server.on("/reset", HTTP_POST, handleReset);

  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("[HTTP] Server running on port 80 (normal)");

  lastSend = 0;
  lastHeartbeat = 0;
  lastProvisionAttempt = 0;
}

// =====================================
// SETUP / LOOP
// =====================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[BOOT] Smart Garden");

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Pairing requires only Wi-Fi + userId
  if (!hasUserId() || !hasWifiCreds()) startPairingMode();
  else startNormalMode();
}

void loop() {
  if (isPairingMode) {
    dnsServer.processNextRequest();
    server.handleClient();
    delay(1);
    return;
  }

  server.handleClient();
  ensureWifiConnected();

  unsigned long now = millis();

  // 1) ensure we have nodeToken + potId
  ensureProvisioned();

  // 2) heartbeat (only if provisioned)
  if (WiFi.status() == WL_CONNECTED && hasNodeToken()) {
    if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = now;
      bool ok = sendHeartbeatOnce();
      Serial.println(ok ? "[HEARTBEAT] OK" : "[HEARTBEAT] FAIL");
    }
  }

  // 3) telemetry (only if provisioned)
  if (WiFi.status() == WL_CONNECTED && hasNodeToken() && hasPotId()) {
    if (now - lastSend >= SEND_INTERVAL_MS) {
      lastSend = now;
      bool ok = sendTelemetryOnce();
      Serial.println(ok ? "[TELEMETRY] OK" : "[TELEMETRY] FAIL");
    }
  }

  delay(1);
}
