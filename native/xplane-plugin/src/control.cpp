#include "xmc/control.hpp"
#include <array>
namespace xmc {
void ControlSurface::resolve() {
    roll_override_ = XPLMFindDataRef("sim/operation/override/override_joystick_roll");
    pitch_override_ = XPLMFindDataRef("sim/operation/override/override_joystick_pitch");
    roll_ = XPLMFindDataRef("sim/joystick/yoke_roll_ratio");
    pitch_ = XPLMFindDataRef("sim/joystick/yoke_pitch_ratio");
    throttle_ = XPLMFindDataRef("sim/cockpit2/engine/actuators/throttle_ratio_all");
}
bool ControlSurface::action(std::string_view name) {
    constexpr std::array<std::pair<std::string_view, const char*>, 6> commands{{
        {"trim-up", "sim/flight_controls/pitch_trim_up"},
        {"trim-down", "sim/flight_controls/pitch_trim_down"},
        {"flaps-up", "sim/flight_controls/flaps_up"},
        {"flaps-down", "sim/flight_controls/flaps_down"},
        {"gear-toggle", "sim/flight_controls/landing_gear_toggle"},
        {"spoilers-toggle", "sim/flight_controls/speed_brakes_toggle"},
    }};
    for (auto [key, path] : commands) {
        if (name != key) continue;
        if (const auto ref = XPLMFindCommand(path)) { XPLMCommandOnce(ref); return true; }
        return false;
    }
    return false;
}
bool ControlSurface::apply(const Command& cmd) {
    if (cmd.operation == Operation::Disarm) { release(); return true; }
    if (cmd.operation == Operation::Arm) {
        if (armed_ || !roll_override_ || !pitch_override_ || !roll_ || !pitch_ ||
            !XPLMCanWriteDataRef(roll_override_) || !XPLMCanWriteDataRef(pitch_override_) ||
            !XPLMCanWriteDataRef(roll_) || !XPLMCanWriteDataRef(pitch_) ||
            XPLMGetDatai(roll_override_) != 0 || XPLMGetDatai(pitch_override_) != 0) return false;
        XPLMSetDatai(roll_override_, 1);
        XPLMSetDatai(pitch_override_, 1);
        owned_override_ = true;
        armed_ = true;
        has_sequence_ = false;
        XPLMSetDataf(roll_, 0.0f);
        XPLMSetDataf(pitch_, 0.0f);
        last_control_ = std::chrono::steady_clock::now();
        return true;
    }
    if (!armed_) return false;
    if (std::chrono::steady_clock::now() - last_control_ > std::chrono::milliseconds(350)) {
        release(); return false;
    }
    if (cmd.operation == Operation::Control) {
        if (has_sequence_ && cmd.sequence <= last_sequence_) return false;
        has_sequence_ = true;
        last_sequence_ = cmd.sequence;
        XPLMSetDataf(roll_, cmd.roll);
        XPLMSetDataf(pitch_, cmd.pitch);
        last_control_ = std::chrono::steady_clock::now();
        return true;
    }
    if (cmd.operation == Operation::Throttle) {
        if (!throttle_ || !XPLMCanWriteDataRef(throttle_)) return false;
        XPLMSetDataf(throttle_, cmd.throttle);
        return true;
    }
    if (cmd.operation == Operation::Action) return action(cmd.action);
    return false;
}
void ControlSurface::tick() {
    if (armed_ && std::chrono::steady_clock::now() - last_control_ > std::chrono::milliseconds(350)) release();
}
void ControlSurface::release() {
    if (owned_override_) {
        if (roll_) XPLMSetDataf(roll_, 0.0f);
        if (pitch_) XPLMSetDataf(pitch_, 0.0f);
        if (roll_override_) XPLMSetDatai(roll_override_, 0);
        if (pitch_override_) XPLMSetDatai(pitch_override_, 0);
    }
    owned_override_ = false;
    armed_ = false;
    has_sequence_ = false;
}
}  // namespace xmc
