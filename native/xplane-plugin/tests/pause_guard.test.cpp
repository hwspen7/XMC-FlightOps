#include "xmc/pause_guard.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cstring>
#include <iostream>

namespace {
int paused_state = 0;
int toggle_calls = 0;
int pause_available = 1;
}
XPLMDataRef XPLMFindDataRef(const char* name) {
    return pause_available && std::strcmp(name, "sim/time/paused") == 0 ? &paused_state : nullptr;
}
XPLMCommandRef XPLMFindCommand(const char* name) {
    return pause_available && std::strcmp(name, "sim/operation/pause_toggle") == 0
        ? reinterpret_cast<XPLMCommandRef>(1) : nullptr;
}
int XPLMGetDatai(XPLMDataRef ref) { return *static_cast<int*>(ref); }
void XPLMCommandOnce(XPLMCommandRef cmd) {
    assert(cmd != nullptr);
    paused_state = !paused_state;
    ++toggle_calls;
}
int main() {
    using xmc::PauseGuard;
    PauseGuard guard;
    guard.resolve();
    assert(!guard.paused() && !guard.interrupted());
    guard.interrupt();
    assert(guard.paused() && guard.pause_owned() && guard.interrupted() && toggle_calls == 1);
    guard.interrupt();
    assert(toggle_calls == 1); // Duplicate suspend does not unpause.
    assert(!guard.resume(false)); // Resuming before fresh CTRL is rejected.
    assert(guard.paused() && toggle_calls == 1);
    assert(guard.resume(true));
    assert(!guard.paused() && !guard.interrupted() && toggle_calls == 2);
    assert(!guard.resume(true) && toggle_calls == 2); // No second toggle.

    // Preserve a pause the user activated independently.
    paused_state = 1;
    PauseGuard manual;
    manual.resolve();
    manual.interrupt();
    assert(manual.interrupted() && !manual.pause_owned());
    assert(!manual.resume(true));
    assert(paused_state == 1 && toggle_calls == 2);

    // Preserve user's manual resume without toggling the simulator back to pause.
    paused_state = 0;
    PauseGuard changed;
    changed.resolve();
    changed.interrupt();
    assert(changed.pause_owned() && paused_state == 1 && toggle_calls == 3);
    paused_state = 0;
    assert(changed.resume(true));
    assert(paused_state == 0 && toggle_calls == 3);
    changed.interrupt();
    assert(changed.interrupted() && toggle_calls == 4);
    paused_state = 0; // User unpauses during interrupted session.
    changed.reconcile();
    assert(!changed.interrupted() && !changed.pause_owned());
    changed.interrupt();
    assert(changed.interrupted() && changed.pause_owned() && toggle_calls == 5);

    // If the simulator cannot expose pause commands, do not toggle blindly.
    pause_available = 0;
    PauseGuard missing;
    missing.resolve();
    missing.interrupt();
    assert(!missing.pause_owned() && !missing.resume(true));
    assert(toggle_calls == 5);
    std::cout << "Pause guard tests passed\n";
}
