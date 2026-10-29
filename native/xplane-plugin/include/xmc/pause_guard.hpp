#pragma once
#include "XPLMDataAccess.h"
#include "XPLMUtilities.h"

namespace xmc {
// A guarded pause action owned by this plugin, never a blind pause toggle.
// Manual/external pauses must never be undone by a remote controller.
class PauseGuard {
public:
    void resolve() noexcept;
    void interrupt() noexcept;
    bool resume(bool fresh_control) noexcept;
    void reconcile() noexcept;
    bool paused() const noexcept;
    bool interrupted() const noexcept { return interrupted_; }
    bool pause_owned() const noexcept { return pause_owned_ && paused(); }
private:
    XPLMDataRef pause_ref_ = nullptr;
    XPLMCommandRef toggle_command_ = nullptr;
    bool interrupted_ = false;
    bool pause_owned_ = false;
};
} // namespace xmc
