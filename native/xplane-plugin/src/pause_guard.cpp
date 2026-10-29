#include "xmc/pause_guard.hpp"

namespace xmc {
void PauseGuard::resolve() noexcept {
    pause_ref_ = XPLMFindDataRef("sim/time/paused");
    toggle_command_ = XPLMFindCommand("sim/operation/pause_toggle");
}

bool PauseGuard::paused() const noexcept {
    return pause_ref_ != nullptr && XPLMGetDatai(pause_ref_) != 0;
}

void PauseGuard::interrupt() noexcept {
    if (interrupted_) return; // Repeated SUSPEND must never unpause the sim.
    interrupted_ = true;
    pause_owned_ = false;
    if (!pause_ref_ || !toggle_command_ || paused()) return;
    XPLMCommandOnce(toggle_command_);
    // Read back actual simulator state before claiming ownership.
    pause_owned_ = paused();
}

void PauseGuard::reconcile() noexcept {
    // An external unpause ends our interruption session. Otherwise the next
    // interruption would be ignored as an already-handled SUSPEND.
    if (interrupted_ && !paused()) {
        interrupted_ = false;
        pause_owned_ = false;
    }
}

bool PauseGuard::resume(bool fresh_control) noexcept {
    if (!fresh_control || !interrupted_ || !pause_ref_ || !pause_owned_) return false;
    // Someone may have manually unpaused. Never issue a blind toggle.
    if (paused() && toggle_command_) XPLMCommandOnce(toggle_command_);
    if (paused()) return false;
    interrupted_ = false;
    pause_owned_ = false;
    return true;
}
} // namespace xmc
