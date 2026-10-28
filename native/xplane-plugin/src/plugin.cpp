#include "xmc/config.hpp"
#include "xmc/control.hpp"
#include "xmc/network.hpp"
#include "xmc/protocol.hpp"
#include "xmc/telemetry.hpp"
#include "XPLMPlugin.h"
#include "XPLMDataAccess.h"
#include "XPLMProcessing.h"
#include "XPLMUtilities.h"
#include <chrono>
#include <cstring>
#include <filesystem>
#include <memory>
#include <string>
namespace {
std::optional<xmc::Config> config;
xmc::UdpLink udp_link;
xmc::ControlSurface control;
xmc::Telemetry telemetry;
bool running = false;
bool resolved = false;
std::chrono::steady_clock::time_point last_telemetry{};
std::string override_state() {
    // Read-only diagnostics. Never change override ownership while probing.
    const auto read = [](const char* name) -> std::string {
        const XPLMDataRef ref = XPLMFindDataRef(name);
        return ref ? std::to_string(XPLMGetDatai(ref)) : "missing";
    };
    return "global=" + read("sim/operation/override/override_joystick") +
           " roll=" + read("sim/operation/override/override_joystick_roll") +
           " pitch=" + read("sim/operation/override/override_joystick_pitch") +
           " mouse=" + read("sim/joystick/mouse_is_joystick") +
           " joystick=" + read("sim/joystick/has_joystick");
}
void log_override_state(const char* context) {
    const std::string line = std::string("XPlane Motion Controller: ") + context +
                             " " + override_state() + "\n";
    XPLMDebugString(line.c_str());
}

float flight_loop(float, float, int, void*) {
    if (!running || !config) return -1.0f;
    if (!resolved) {
        control.resolve();
        telemetry.resolve();
        resolved = true;
        log_override_state("initial override state:");
    }
    for (int attempt = 0; attempt < 32; ++attempt) {
        auto incoming = udp_link.receive();
        if (!incoming) break;
        if (auto command = xmc::parse_command(*incoming, config->token)) {
            const bool accepted = control.apply(*command);
            if (command->operation == xmc::Operation::Arm) {
                // Log only ARM transitions, never individual control frames or credentials.
                const std::string message = accepted
                    ? "XPlane Motion Controller: native ARM accepted.\n"
                    : "XPlane Motion Controller: native ARM rejected (" +
                        std::string(control.arm_error()) + ").\n";
                XPLMDebugString(message.c_str());
                if (!accepted) log_override_state("ARM rejection override state:");
            }
        }
    }
    control.tick();
    const auto now = std::chrono::steady_clock::now();
    if (now - last_telemetry >= std::chrono::milliseconds(100)) {
        // Extend the authenticated telemetry snapshot with native ARM diagnostics.
        // The regular flight telemetry fields remain unchanged.
        std::string packet = telemetry.packet(config->token, control.armed());
        packet += "|armError=";
        packet += control.arm_error();
        udp_link.send(packet);
        last_telemetry = now;
    }
    return -1.0f;
}
}
PLUGIN_API int XPluginStart(char* outName, char* outSig, char* outDesc) {
    std::strcpy(outName, "XPlane Motion Controller");
    std::strcpy(outSig, "org.xplane-motion-controller.native");
    std::strcpy(outDesc, "Native motion control and telemetry bridge");
    char file_path[1024]{};
    XPLMGetPluginInfo(XPLMGetMyID(), nullptr, file_path, nullptr, nullptr);
    const auto config_path = std::filesystem::path(file_path).parent_path().parent_path() / "controller.conf";
    config = xmc::load_config(config_path);
    if (!config) XPLMDebugString("XPlane Motion Controller: missing or invalid controller.conf; networking disabled.\n");
    else if (!udp_link.open(*config)) {
        XPLMDebugString("XPlane Motion Controller: UDP bind failed; networking disabled.\n");
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
PLUGIN_API int XPluginEnable() { running = true; resolved = false; return 1; }
PLUGIN_API void XPluginDisable() { running = false; control.release(); }
PLUGIN_API void XPluginReceiveMessage(XPLMPluginID, int, void*) {}
