#pragma once
#include <cstdint>
#include <optional>
#include <string>
#include <filesystem>
namespace xmc {
struct Config {
    std::string token;
    std::string bind_address = "127.0.0.1";
    std::string peer_address = "127.0.0.1";
    std::uint16_t listen_port = 49051;
    std::uint16_t telemetry_port = 49052;
};
std::optional<Config> load_config(const std::filesystem::path& file);
}  // namespace xmc
