#pragma once
#include "xmc/protocol.hpp"
#include <chrono>
#include <cstdint>
#include <string_view>
#include "XPLMDataAccess.h"
#include "XPLMUtilities.h"
namespace xmc {
class ControlSurface {
public:
    void resolve();
    bool apply(const Command& command);
    void tick();
    void release();
    bool armed() const { return armed_; }
    bool autopilot_active() const;
    bool reverse_active() const { return reverse_active_; }
    float commanded_rudder() const { return commanded_rudder_; }
    float commanded_brakes() const { return commanded_brakes_; }
    // Called on every flight-loop step, never from an off-thread network callback.
    bool autopilot_handover();
    bool has_applied_input() const { return armed_ && has_sequence_; }
    float applied_roll() const { return applied_roll_; }
    float applied_pitch() const { return applied_pitch_; }
    bool fresh_input() const {
        return armed_ && has_sequence_ &&
            std::chrono::steady_clock::now() - last_control_ < std::chrono::milliseconds(250);
    }
    // A stable, non-secret diagnostic code from the last ARM attempt.
    std::string_view arm_error() const { return arm_error_; }
private:
    XPLMDataRef roll_override_ = nullptr;
    XPLMDataRef pitch_override_ = nullptr;
    XPLMDataRef roll_ = nullptr;
    XPLMDataRef pitch_ = nullptr;
    XPLMDataRef throttle_ = nullptr;
    XPLMDataRef reverse_ = nullptr;
    XPLMDataRef on_ground_ = nullptr;
    XPLMDataRef autopilot_ = nullptr;
    XPLMDataRef rudder_override_ = nullptr;
    XPLMDataRef rudder_ = nullptr;
    XPLMDataRef left_brake_ = nullptr;
    XPLMDataRef right_brake_ = nullptr;
    bool owned_rudder_ = false;
    bool brakes_commanded_ = false;
    bool reverse_active_ = false;
    float commanded_rudder_ = 0.0f;
    float commanded_brakes_ = 0.0f;
    std::chrono::steady_clock::time_point brakes_last_{};
    bool armed_ = false;
    bool owned_override_ = false;
    std::string_view arm_error_ = "none";
    bool has_sequence_ = false;
    float applied_roll_ = 0.0f;
    float applied_pitch_ = 0.0f;
    std::uint64_t last_sequence_ = 0;
    std::chrono::steady_clock::time_point last_control_{};
    bool action(std::string_view name);
};
}  // namespace xmc
