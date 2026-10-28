#pragma once

#include <optional>
#include "xmc/protocol.hpp"

namespace xmc {

// The plugin runs on the simulator's flight-loop thread. Sensor frames can
// arrive faster than flight-loop ticks; only the newest control frame is
// meaningful. ARM/DISARM and discrete actions must never be coalesced.
class LatestControl {
public:
    void offer(const Command& frame) noexcept;
    std::optional<Command> take() noexcept;
    void discard() noexcept;
    bool has_pending() const noexcept { return newest_.has_value(); }
private:
    std::optional<Command> newest_;
};
} // namespace xmc
