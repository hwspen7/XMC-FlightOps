#include "xmc/control.hpp"
#include <array>
namespace xmc {
void ControlSurface::resolve() {
    roll_override_ = XPLMFindDataRef("sim/operation/override/override_joystick_roll");
    pitch_override_ = XPLMFindDataRef("sim/operation/override/override_joystick_pitch");
    roll_ = XPLMFindDataRef("sim/joystick/yoke_roll_ratio");
    pitch_ = XPLMFindDataRef("sim/joystick/yoke_pitch_ratio");
    throttle_ = XPLMFindDataRef("sim/cockpit2/engine/actuators/throttle_ratio_all");
    reverse_ = XPLMFindDataRef("sim/cockpit2/engine/actuators/throttle_jet_rev_ratio_all");
    on_ground_ = XPLMFindDataRef("sim/flightmodel/failures/onground_any");
    autopilot_ = XPLMFindDataRef("sim/cockpit2/autopilot/servos_on");
    rudder_override_ = XPLMFindDataRef("sim/operation/override/override_joystick_heading");
    rudder_ = XPLMFindDataRef("sim/joystick/yoke_heading_ratio");
    left_brake_ = XPLMFindDataRef("sim/cockpit2/controls/left_brake_ratio");
    right_brake_ = XPLMFindDataRef("sim/cockpit2/controls/right_brake_ratio");
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
bool ControlSurface::autopilot_active() const {
    return autopilot_ && XPLMGetDatai(autopilot_) != 0;
}
bool ControlSurface::autopilot_handover() {
    if (!armed_ || !autopilot_active()) return false;
    release();
    arm_error_ = "autopilot-active";
    return true;
}
bool ControlSurface::apply(const Command& cmd) {
    if (cmd.operation == Operation::Disarm) { release(); return true; }
    if (cmd.operation == Operation::Arm) {
        // Fail closed. Never steal an override already held by another plugin.
        // Report the precise reason without emitting the shared token.
        const auto reject = [this](std::string_view reason) {
            arm_error_ = reason;
            return false;
        };
        // UDP ARM retries are idempotent for the authenticated local peer.
        // Do not reset the control watchdog on a duplicate ARM packet.
        if (armed_) { arm_error_ = "none"; return true; }
        if (autopilot_active()) return reject("autopilot-active");
        if (!roll_override_) return reject("missing-roll-override");
        if (!pitch_override_) return reject("missing-pitch-override");
        if (!roll_) return reject("missing-roll-input");
        if (!pitch_) return reject("missing-pitch-input");
        if (!XPLMCanWriteDataRef(roll_override_)) return reject("readonly-roll-override");
        if (!XPLMCanWriteDataRef(pitch_override_)) return reject("readonly-pitch-override");
        if (!XPLMCanWriteDataRef(roll_)) return reject("readonly-roll-input");
        if (!XPLMCanWriteDataRef(pitch_)) return reject("readonly-pitch-input");
        if (XPLMGetDatai(roll_override_) != 0) return reject("roll-override-busy");
        if (XPLMGetDatai(pitch_override_) != 0) return reject("pitch-override-busy");
        XPLMSetDatai(roll_override_, 1);
        XPLMSetDatai(pitch_override_, 1);
        owned_override_ = true;
        armed_ = true;
        arm_error_ = "none";
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
        applied_roll_ = cmd.roll;
        applied_pitch_ = cmd.pitch;
        XPLMSetDataf(roll_, cmd.roll);
        XPLMSetDataf(pitch_, cmd.pitch);
        last_control_ = std::chrono::steady_clock::now();
        return true;
    }
    if (cmd.operation == Operation::Throttle) {
        if (!throttle_ || !XPLMCanWriteDataRef(throttle_)) return false;
        if (reverse_active_ && reverse_ && XPLMCanWriteDataRef(reverse_)) {
            XPLMSetDataf(reverse_, 0.0f);
            reverse_active_ = false;
        }
        XPLMSetDataf(throttle_, cmd.throttle);
        return true;
    }
    if (cmd.operation == Operation::Rudder) {
        if (!rudder_override_ || !rudder_ || !XPLMCanWriteDataRef(rudder_override_) || !XPLMCanWriteDataRef(rudder_)) return false;
        if (!owned_rudder_) {
            if (XPLMGetDatai(rudder_override_) != 0) return false;
            XPLMSetDatai(rudder_override_, 1);
            owned_rudder_ = true;
        }
        commanded_rudder_ = cmd.throttle;
        XPLMSetDataf(rudder_, commanded_rudder_);
        return true;
    }
    if (cmd.operation == Operation::Brakes) {
        if (!left_brake_ || !right_brake_ || !XPLMCanWriteDataRef(left_brake_) || !XPLMCanWriteDataRef(right_brake_)) return false;
        commanded_brakes_ = cmd.throttle;
        brakes_commanded_ = true;
        brakes_last_ = std::chrono::steady_clock::now();
        XPLMSetDataf(left_brake_, cmd.throttle);
        XPLMSetDataf(right_brake_, cmd.throttle);
        return true;
    }
    if (cmd.operation == Operation::Reverse) {
        // Fail closed if the aircraft ground state or reverse-capable handle is unsupported.
        if (!reverse_ || !on_ground_ || !throttle_ || !XPLMCanWriteDataRef(reverse_)) return false;
        if (cmd.throttle > 0 && (XPLMGetDatai(on_ground_) == 0 || XPLMGetDataf(throttle_) > 0.06f)) return false;
        // Forward lever is driven to idle first. Reverse values are negative.
        if (cmd.throttle > 0) XPLMSetDataf(throttle_, 0.0f);
        XPLMSetDataf(reverse_, -cmd.throttle);
        reverse_active_ = cmd.throttle > 0;
        return true;
    }
    if (cmd.operation == Operation::Action) return action(cmd.action);
    return false;
}
void ControlSurface::tick() {
    // A stalled button/release packet must never leave the wheel brakes latched.
    if (brakes_commanded_ && std::chrono::steady_clock::now() - brakes_last_ > std::chrono::milliseconds(500)) {
        if (left_brake_) XPLMSetDataf(left_brake_, 0.0f);
        if (right_brake_) XPLMSetDataf(right_brake_, 0.0f);
        commanded_brakes_ = 0;
        brakes_commanded_ = false;
    }
    if (armed_ && std::chrono::steady_clock::now() - last_control_ > std::chrono::milliseconds(350)) release();
}
void ControlSurface::release() {
    if (owned_rudder_) {
        if (rudder_) XPLMSetDataf(rudder_, 0.0f);
        if (rudder_override_) XPLMSetDatai(rudder_override_, 0);
    }
    owned_rudder_ = false;
    commanded_rudder_ = 0.0f;
    if (brakes_commanded_) {
        if (left_brake_) XPLMSetDataf(left_brake_, 0.0f);
        if (right_brake_) XPLMSetDataf(right_brake_, 0.0f);
    }
    brakes_commanded_ = false;
    commanded_brakes_ = 0.0f;
    if (reverse_active_ && reverse_ && XPLMCanWriteDataRef(reverse_)) XPLMSetDataf(reverse_, 0.0f);
    reverse_active_ = false;
    if (owned_override_) {
        if (roll_) XPLMSetDataf(roll_, 0.0f);
        if (pitch_) XPLMSetDataf(pitch_, 0.0f);
        if (roll_override_) XPLMSetDatai(roll_override_, 0);
        if (pitch_override_) XPLMSetDatai(pitch_override_, 0);
    }
    owned_override_ = false;
    armed_ = false;
    has_sequence_ = false;
    applied_roll_ = 0.0f;
    applied_pitch_ = 0.0f;
}
}  // namespace xmc
