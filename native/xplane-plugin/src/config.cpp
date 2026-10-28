#include "xmc/config.hpp"
#include "xmc/protocol.hpp"
#include <algorithm>
#include <charconv>
#include <fstream>
#include <string>
#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#endif
namespace xmc {
namespace {
bool ipv4(const std::string& value) {
    in_addr address{};
    return inet_pton(AF_INET, value.c_str(), &address) == 1;
}
bool port(const std::string& value, std::uint16_t& target) {
    unsigned int parsed = 0;
    auto [ptr, error] = std::from_chars(value.data(), value.data() + value.size(), parsed);
    if (error != std::errc{} || ptr != value.data() + value.size() || parsed == 0 || parsed > 65535) return false;
    target = static_cast<std::uint16_t>(parsed);
    return true;
}
}  // namespace
std::optional<Config> load_config(const std::filesystem::path& file) {
    std::ifstream stream(file);
    if (!stream) return std::nullopt;
    Config result;
    std::string line;
    while (std::getline(stream, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        const auto comment = line.find('#');
        if (comment != std::string::npos) line.erase(comment);
        const auto equals = line.find('=');
        if (equals == std::string::npos) continue;
        auto key = line.substr(0, equals), value = line.substr(equals + 1);
        auto trim = [](std::string& text) {
            const auto start = text.find_first_not_of(" \t");
            if (start == std::string::npos) { text.clear(); return; }
            const auto end = text.find_last_not_of(" \t");
            text = text.substr(start, end - start + 1);
        };
        trim(key); trim(value);
        if (key == "token") result.token = value;
        else if (key == "bind_address") result.bind_address = value;
        else if (key == "peer_address") result.peer_address = value;
        else if (key == "listen_port" && !port(value, result.listen_port)) return std::nullopt;
        else if (key == "telemetry_port" && !port(value, result.telemetry_port)) return std::nullopt;
    }
    if (!valid_token(result.token) || !ipv4(result.bind_address) || !ipv4(result.peer_address)) return std::nullopt;
    return result;
}
}  // namespace xmc
