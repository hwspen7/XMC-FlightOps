#pragma once
#include <cstdint>
#include <optional>
#include <string_view>

namespace xmc {
enum class Operation { Arm, Control, Disarm, Suspend, Resume, Throttle, Rudder, Brakes, Reverse, Action };
struct Command {
    Operation operation;
    std::uint64_t sequence = 0;
    float roll = 0;
    float pitch = 0;
    float throttle = 0;
    std::string_view action;
};
// The caller must independently authenticate the source IP and shared token.
std::optional<Command> parse_command(std::string_view packet, std::string_view token);
bool valid_token(std::string_view token);
}  // namespace xmc
