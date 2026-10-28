#include <chrono>
#include <cstring>
#include <filesystem>
#include <memory>
#include <string>

#include "XPLMPlugin.h"
#include "XPLMProcessing.h"
#include "XPLMUtilities.h"
#include "xmc/config.hpp"
#include "xmc/control.hpp"
#include "xmc/network.hpp"
#include "xmc/protocol.hpp"
#include "xmc/telemetry.hpp"
namespace {
std::optional<xmc::Config> config;
xmc::UdpLink udp_link;
xmc::ControlSurface control;
xmc::Telemetry telemetry;
bool running = false;
bool resolved = false;
std::chrono::steady_clock::time_point last_telemetry{};
float flight_loop(float, float, int, void*) {
  if (!running || !config) return -1.0f;
  if (!resolved) {
    control.resolve();
    telemetry.resolve();
    resolved = true;
  }
  for (int attempt = 0; attempt < 32; ++attempt) {
    auto incoming = udp_link.receive();
    if (!incoming) break;
    if (auto command = xmc::parse_command(*incoming, config->token))
      control.apply(*command);
  }
  control.tick();
  const auto now = std::chrono::steady_clock::now();
  if (now - last_telemetry >= std::chrono::milliseconds(100)) {
    udp_link.send(telemetry.packet(config->token, control.armed()));
    last_telemetry = now;
  }
  return -1.0f;
}
}  // namespace
PLUGIN_API int XPluginStart(char* outName, char* outSig, char* outDesc) {
  std::strcpy(outName, "XPlane Motion Controller");
  std::strcpy(outSig, "org.xplane-motion-controller.native");
  std::strcpy(outDesc, "Native motion control and telemetry bridge");
  char file_path[1024]{};
  XPLMGetPluginInfo(XPLMGetMyID(), nullptr, file_path, nullptr, nullptr);
  const auto config_path =
      std::filesystem::path(file_path).parent_path().parent_path() /
      "controller.conf";
  config = xmc::load_config(config_path);
  if (!config)
    XPLMDebugString(
        "XPlane Motion Controller: missing or invalid controller.conf; "
        "networking disabled.\n");
  else if (!udp_link.open(*config)) {
    XPLMDebugString(
        "XPlane Motion Controller: UDP bind failed; networking disabled.\n");
    config.reset();
  }
  XPLMRegisterFlightLoopCallback(flight_loop, -1.0f, nullptr);
  return 1;
}
PLUGIN_API void XPluginStop() {
  XPLMUnregisterFlightLoopCallback(flight_loop, nullptr);
  control.release();
  udp_link.close();
  config.reset();
  running = false;
}
PLUGIN_API int XPluginEnable() {
  running = true;
  resolved = false;
  return 1;
}
PLUGIN_API void XPluginDisable() {
  running = false;
  control.release();
}
PLUGIN_API void XPluginReceiveMessage(XPLMPluginID, int, void*) {}
