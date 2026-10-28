#include "xmc/network.hpp"
#include <cstring>
#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <unistd.h>
#include <cerrno>
#endif
namespace xmc {
UdpLink::~UdpLink() { close(); }
bool UdpLink::open(const Config& config) {
    close();
#ifdef _WIN32
    WSADATA startup{};
    if (WSAStartup(MAKEWORD(2, 2), &startup) != 0) return false;
#endif
    fd_ = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
#ifdef _WIN32
    if (fd_ == INVALID_SOCKET) { WSACleanup(); return false; }
    u_long mode = 1;
    if (ioctlsocket(fd_, FIONBIO, &mode) != 0) { close(); return false; }
#else
    if (fd_ < 0) return false;
    if (fcntl(fd_, F_SETFL, fcntl(fd_, F_GETFL, 0) | O_NONBLOCK) != 0) { close(); return false; }
#endif
    sockaddr_in local{};
    local.sin_family = AF_INET;
    local.sin_port = htons(config.listen_port);
    if (inet_pton(AF_INET, config.bind_address.c_str(), &local.sin_addr) != 1 ||
        bind(fd_, reinterpret_cast<sockaddr*>(&local), sizeof(local)) != 0) { close(); return false; }
    peer_.sin_family = AF_INET;
    if (inet_pton(AF_INET, config.peer_address.c_str(), &peer_.sin_addr) != 1) { close(); return false; }
    destination_ = peer_;
    destination_.sin_port = htons(config.telemetry_port);
    ready_ = true;
    return true;
}
void UdpLink::close() {
#ifdef _WIN32
    if (fd_ != INVALID_SOCKET) { closesocket(fd_); fd_ = INVALID_SOCKET; WSACleanup(); }
#else
    if (fd_ >= 0) { ::close(fd_); fd_ = -1; }
#endif
    ready_ = false;
}
std::optional<std::string_view> UdpLink::receive() {
    if (!ready_) return std::nullopt;
    sockaddr_in source{};
#ifdef _WIN32
    int address_length = sizeof(source);
    const int received = recvfrom(fd_, buffer_.data(), static_cast<int>(buffer_.size()), 0,
                                  reinterpret_cast<sockaddr*>(&source), &address_length);
#else
    socklen_t address_length = sizeof(source);
    const ssize_t received = recvfrom(fd_, buffer_.data(), buffer_.size(), 0,
                                      reinterpret_cast<sockaddr*>(&source), &address_length);
#endif
    if (received <= 0 || source.sin_family != AF_INET ||
        source.sin_addr.s_addr != peer_.sin_addr.s_addr) return std::nullopt;
    return std::string_view(buffer_.data(), static_cast<std::size_t>(received));
}
bool UdpLink::send(std::string_view payload) const {
    if (!ready_) return false;
    const auto sent = sendto(fd_, payload.data(), static_cast<int>(payload.size()), 0,
                             reinterpret_cast<const sockaddr*>(&destination_), sizeof(destination_));
    return sent == static_cast<decltype(sent)>(payload.size());
}
}  // namespace xmc
