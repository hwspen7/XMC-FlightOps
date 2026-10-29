#include "xmc/config.hpp"
#include "xmc/control.hpp"
#include "xmc/native_metrics.hpp"
#include "xmc/pause_guard.hpp"
#include "xmc/latest_control.hpp"
#include "xmc/network.hpp"
#include "xmc/protocol.hpp"
#include "xmc/telemetry.hpp"
#include "xmc/flight_analysis.hpp"
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
xmc::NativeMetrics native_metrics;
xmc::LatestControl latest_control;
xmc::Telemetry telemetry;
xmc::FlightAnalysis flight_analysis;
xmc::PauseGuard pause_guard;
bool running = false;
bool resolved = false;
XPLMCommandRef hide_mouse_yoke = nullptr;
XPLMCommandRef restore_mouse_yoke = nullptr;
XPLMDataRef mouse_yoke_ref = nullptr;
bool mouse_was_active = false;
bool mouse_hidden_by_us = false;
void restore_mouse() {
    if (mouse_hidden_by_us && restore_mouse_yoke && mouse_was_active) XPLMCommandOnce(restore_mouse_yoke);
    mouse_hidden_by_us = false;
}
void maybe_hide_mouse() {
    // Optional integration. Vanilla mouse_is_joystick is read-only; never write it.
    mouse_was_active = mouse_yoke_ref && XPLMGetDatai(mouse_yoke_ref) != 0;
    if (hide_mouse_yoke) {
        XPLMCommandOnce(hide_mouse_yoke);
        mouse_hidden_by_us = true;
    }
}
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
        pause_guard.resolve();
        mouse_yoke_ref = XPLMFindDataRef("sim/joystick/mouse_is_joystick");
        hide_mouse_yoke = XPLMFindCommand("FlyWithLua/SimpleMouseYoke/HideMouseYoke");
        restore_mouse_yoke = XPLMFindCommand("FlyWithLua/SimpleMouseYoke/ShowMouseYoke");
        resolved = true;
        log_override_state("initial override state:");
    }
    pause_guard.reconcile();
    // Autopilot takes precedence. Never fight its servos for flight-control authority.
    if (control.autopilot_handover()) {
        latest_control.discard();
        native_metrics.on_disarm();
        restore_mouse();
        XPLMDebugString("XPlane Motion Controller: autopilot active; released remote input.\n");
    }
    native_metrics.on_flight_loop(xmc::NativeMetrics::Clock::now());
    // Preserve ARM/DISARM ordering but coalesce high-frequency CTRL input to
    // the newest sequence in the current flight-loop tick.
    const auto apply_latest = [&]() {
        if (const auto frame = latest_control.take()) {
            const auto started = xmc::NativeMetrics::Clock::now();
            const bool accepted = control.apply(*frame);
            const auto finished = xmc::NativeMetrics::Clock::now();
            if (accepted) native_metrics.on_control_applied(frame->sequence, started, finished);
        }
    };
    for (int attempt = 0; attempt < 32; ++attempt) {
        auto incoming = udp_link.receive();
        if (!incoming) break;
        if (auto command = xmc::parse_command(*incoming, config->token)) {
            if (command->operation == xmc::Operation::Control) {
                latest_control.offer(*command);
                continue;
            }
            // An ARM changes ownership and DISARM must take priority over any
            // queued control packet. Discard stale controls at those barriers.
            if (command->operation == xmc::Operation::Arm ||
                command->operation == xmc::Operation::Disarm ||
                command->operation == xmc::Operation::Suspend ||
                command->operation == xmc::Operation::Resume) latest_control.discard();
            else apply_latest(); // Preserve order around throttle/auxiliary actions.
            if (command->operation == xmc::Operation::Suspend) {
                const bool was_interrupted = pause_guard.interrupted();
                if (control.armed() || pause_guard.interrupted()) pause_guard.interrupt();
                control.release();
                native_metrics.on_disarm();
                restore_mouse();
                if (!was_interrupted && pause_guard.interrupted())
                    XPLMDebugString("XPlane Motion Controller: input interrupted; pause requested.\n");
                continue;
            }
            if (command->operation == xmc::Operation::Resume) {
                // Fresh input and plugin-owned pause are mandatory. Never unpause
                // an independently paused simulator.
                if (pause_guard.resume(control.fresh_input()))
                    XPLMDebugString("XPlane Motion Controller: flight resumed by pilot request.\n");
                continue;
            }
            // The C++ flight-loop thread owns both command application and timing.
            // Never convert these timestamps to wall-clock time.
            const bool previously_armed = control.armed();
            const auto started = xmc::NativeMetrics::Clock::now();
            const bool accepted = control.apply(*command);
            const auto finished = xmc::NativeMetrics::Clock::now();
            if (accepted && command->operation == xmc::Operation::Arm && !previously_armed)
                native_metrics.on_arm();
            if (accepted && command->operation == xmc::Operation::Arm && !previously_armed) maybe_hide_mouse();
            if (command->operation == xmc::Operation::Disarm) { native_metrics.on_disarm(); restore_mouse(); }
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
    apply_latest();
    const bool was_armed = control.armed();
    control.tick();
    // Native watchdog still protects the aircraft if Safari is suspended before
    // it can notify NestJS, or if the websocket/UDP messages are lost.
    if (was_armed && !control.armed()) {
        pause_guard.interrupt();
        restore_mouse();
        XPLMDebugString("XPlane Motion Controller: input watchdog expired; pause requested.\n");
    }
    if (!control.armed() && native_metrics.active()) native_metrics.on_disarm();
    const auto now = std::chrono::steady_clock::now();
    if (now - last_telemetry >= std::chrono::milliseconds(100)) {
        // Extend the authenticated telemetry snapshot with native ARM diagnostics.
        // The regular flight telemetry fields remain unchanged.
        std::string packet = telemetry.packet(config->token, control.armed());
        packet += "|armError=";
        packet += control.arm_error();
        packet += std::string("|simPaused=") + (pause_guard.paused() ? "1" : "0");
        packet += std::string("|nativeInterrupted=") + (pause_guard.interrupted() ? "1" : "0");
        packet += std::string("|pauseOwned=") + (pause_guard.pause_owned() ? "1" : "0");
        // The command values describe the last successfully applied native frame,
        // not the phone's newest unsynchronized UI frame.
        if (control.has_applied_input()) {
            packet += "|nativeCommandRollRatio=" + std::to_string(control.applied_roll());
            packet += "|nativeCommandPitchRatio=" + std::to_string(control.applied_pitch());
        }
        packet += "|reverseActive=" + std::to_string(control.reverse_active() ? 1 : 0);
        packet += "|mouseYokeActive=" + std::to_string(mouse_yoke_ref ? XPLMGetDatai(mouse_yoke_ref) : 0);
        packet += "|mouseYokeHideAvailable=" + std::to_string(hide_mouse_yoke != nullptr);
        packet += flight_analysis.process(packet, now).append_fields();
        native_metrics.append_telemetry(packet, now);
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
    restore_mouse();
    native_metrics.on_disarm();
    latest_control.discard();
    udp_link.close();
    config.reset();
    running = false;
}
PLUGIN_API int XPluginEnable() { running = true; resolved = false; native_metrics = xmc::NativeMetrics{}; latest_control.discard(); flight_analysis.reset(); return 1; }
PLUGIN_API void XPluginDisable() { running = false; control.release(); restore_mouse(); native_metrics.on_disarm(); latest_control.discard(); }
PLUGIN_API void XPluginReceiveMessage(XPLMPluginID, int, void*) {}
