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
private:
    XPLMDataRef roll_override_ = nullptr;
    XPLMDataRef pitch_override_ = nullptr;
    XPLMDataRef roll_ = nullptr;
    XPLMDataRef pitch_ = nullptr;
    XPLMDataRef throttle_ = nullptr;
    bool armed_ = false;
    bool owned_override_ = false;
    bool has_sequence_ = false;
    std::uint64_t last_sequence_ = 0;
    std::chrono::steady_clock::time_point last_control_{};
    bool action(std::string_view name);
};
}  // namespace xmc
