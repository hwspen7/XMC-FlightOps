#include "xmc/latest_control.hpp"

namespace xmc {
void LatestControl::offer(const Command& frame) noexcept {
    if (frame.operation != Operation::Control) return;
    if (newest_ && frame.sequence <= newest_->sequence) return;
    // No string_view of the receive buffer survives between UDP receives.
    newest_ = Command{Operation::Control, frame.sequence, frame.roll, frame.pitch, 0.0f, {}};
}
std::optional<Command> LatestControl::take() noexcept {
    auto result = newest_;
    newest_.reset();
    return result;
}
void LatestControl::discard() noexcept { newest_.reset(); }
} // namespace xmc
