#pragma once
#include "xmc/config.hpp"
#include <array>
#include <cstddef>
#include <optional>
#include <string_view>
#include <utility>
#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <netinet/in.h>
#endif
namespace xmc {
class UdpLink {
public:
    UdpLink() = default;
    ~UdpLink();
    UdpLink(const UdpLink&) = delete;
    UdpLink& operator=(const UdpLink&) = delete;
    bool open(const Config& config);
    void close();
    std::optional<std::string_view> receive();
    bool send(std::string_view payload) const;
private:
#ifdef _WIN32
    SOCKET fd_ = INVALID_SOCKET;
#else
    int fd_ = -1;
#endif
    sockaddr_in peer_{};
    sockaddr_in destination_{};
    std::array<char, 4096> buffer_{};
    bool ready_ = false;
};
}  // namespace xmc
