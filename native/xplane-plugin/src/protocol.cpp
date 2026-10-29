#include "xmc/protocol.hpp"
#include <charconv>
#include <cmath>
#include <cerrno>
#include <cstdlib>
#include <string>
#include <array>

namespace xmc {
namespace {
bool token_equals(std::string_view a, std::string_view b) {
    if (a.size() != b.size()) return false;
    unsigned char mismatch = 0;
    for (std::size_t i = 0; i < a.size(); ++i)
        mismatch |= static_cast<unsigned char>(a[i] ^ b[i]);
    return mismatch == 0;
}
bool parse_float(std::string_view text, float& output) {
    if (text.empty() || text.size() > 32) return false;
    const std::string value(text);
    char* end = nullptr;
    errno = 0;
    const float parsed = std::strtof(value.c_str(), &end);
    if (errno != 0 || end != value.c_str() + value.size() || !std::isfinite(parsed)) return false;
    output = parsed;
    return true;
}
bool parse_sequence(std::string_view text, std::uint64_t& result) {
    if (text.empty() || text.front() == '-') return false;
    const auto [ptr, error] = std::from_chars(text.data(), text.data() + text.size(), result);
    return error == std::errc{} && ptr == text.data() + text.size();
}
}  // namespace
bool valid_token(std::string_view token) {
    if (token.size() < 16 || token.size() > 128 || token.starts_with("REPLACE_WITH")) return false;
    for (char c : token) {
        if (!(c >= 'a' && c <= 'z') && !(c >= 'A' && c <= 'Z') &&
            !(c >= '0' && c <= '9') && c != '_' && c != '-') return false;
    }
    return true;
}
std::optional<Command> parse_command(std::string_view packet, std::string_view token) {
    if (packet.size() > 256 || !valid_token(token)) return std::nullopt;
    std::array<std::string_view, 7> parts{};
    std::size_t count = 0, offset = 0;
    while (offset <= packet.size() && count < parts.size()) {
        const auto end = packet.find('|', offset);
        parts[count++] = packet.substr(offset, end == std::string_view::npos ? end : end - offset);
        if (end == std::string_view::npos) break;
        offset = end + 1;
    }
    if (count < 3 || parts[0] != "XMC1" || !token_equals(parts[1], token)) return std::nullopt;
    if (count == 3 && parts[2] == "ARM") return Command{Operation::Arm, 0, 0, 0, 0, {}};
    if (count == 3 && parts[2] == "DISARM") return Command{Operation::Disarm, 0, 0, 0, 0, {}};
    if (count == 3 && parts[2] == "SUSPEND") return Command{Operation::Suspend, 0, 0, 0, 0, {}};
    if (count == 3 && parts[2] == "RESUME") return Command{Operation::Resume, 0, 0, 0, 0, {}};
    if (count == 6 && parts[2] == "CTRL") {
        Command cmd{Operation::Control, 0, 0, 0, 0, {}};
        if (!parse_sequence(parts[3], cmd.sequence) ||
            !parse_float(parts[4], cmd.roll) || !parse_float(parts[5], cmd.pitch) ||
            std::fabs(cmd.roll) > 1 || std::fabs(cmd.pitch) > 1) return std::nullopt;
        return cmd;
    }
    if (count == 4 && (parts[2] == "RUDDER" || parts[2] == "BRAKES" || parts[2] == "REVERSE")) {
        Command cmd{parts[2] == "RUDDER" ? Operation::Rudder : parts[2] == "BRAKES" ? Operation::Brakes : Operation::Reverse};
        if (!parse_float(parts[3], cmd.throttle) ||
            (parts[2] == "RUDDER" ? std::fabs(cmd.throttle) > 1 : cmd.throttle < 0 || cmd.throttle > 1)) return std::nullopt;
        return cmd;
    }
    if (count == 4 && parts[2] == "THROTTLE") {
        Command cmd{Operation::Throttle, 0, 0, 0, 0, {}};
        if (!parse_float(parts[3], cmd.throttle) || cmd.throttle < 0 || cmd.throttle > 1) return std::nullopt;
        return cmd;
    }
    if (count == 4 && parts[2] == "ACTION") {
        constexpr std::array<std::string_view, 6> allowed{
            "trim-up", "trim-down", "flaps-up", "flaps-down", "gear-toggle", "spoilers-toggle"};
        for (auto name : allowed) if (parts[3] == name) return Command{Operation::Action, 0, 0, 0, 0, parts[3]};
    }
    return std::nullopt;
}
}  // namespace xmc
