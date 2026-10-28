#include "xmc/control.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <chrono>
#include <cstring>
#include <iostream>
#include <thread>

namespace {
int roll_override_value = 0;
int pitch_override_value = 0;
float roll_value = 0;
float pitch_value = 0;
float throttle_value = 0;
int executed_commands = 0;
bool missing_roll_override = false;
bool writeable = true;
}
XPLMDataRef XPLMFindDataRef(const char* path) {
    if (std::strcmp(path, "sim/operation/override/override_joystick_roll") == 0)
        return missing_roll_override ? nullptr : &roll_override_value;
    if (std::strcmp(path, "sim/operation/override/override_joystick_pitch") == 0) return &pitch_override_value;
    if (std::strcmp(path, "sim/joystick/yoke_roll_ratio") == 0) return &roll_value;
    if (std::strcmp(path, "sim/joystick/yoke_pitch_ratio") == 0) return &pitch_value;
    if (std::strcmp(path, "sim/cockpit2/engine/actuators/throttle_ratio_all") == 0) return &throttle_value;
    return nullptr;
}
int XPLMCanWriteDataRef(XPLMDataRef ref) { return ref != nullptr && writeable; }
int XPLMGetDatai(XPLMDataRef ref) { return *static_cast<int*>(ref); }
void XPLMSetDatai(XPLMDataRef ref, int value) { *static_cast<int*>(ref) = value; }
void XPLMSetDataf(XPLMDataRef ref, float value) { *static_cast<float*>(ref) = value; }
XPLMCommandRef XPLMFindCommand(const char*) { return reinterpret_cast<XPLMCommandRef>(1); }
void XPLMCommandOnce(XPLMCommandRef) { ++executed_commands; }
int main() {
    using namespace xmc;
    ControlSurface controller;
    controller.resolve();
    assert(!controller.apply(Command{Operation::Control, 0, 0.5f, 0.5f}));
    assert(controller.arm_error() == "none");
    writeable = false;
    assert(!controller.apply(Command{Operation::Arm}));
    assert(controller.arm_error() == "readonly-roll-override");
    writeable = true;
    roll_override_value = 1;
    assert(!controller.apply(Command{Operation::Arm})); // Never steal an axis owned by another plugin.
    assert(controller.arm_error() == "roll-override-busy");
    roll_override_value = 0;
    pitch_override_value = 1;
    assert(!controller.apply(Command{Operation::Arm}));
    assert(controller.arm_error() == "pitch-override-busy");
    pitch_override_value = 0;
    assert(controller.apply(Command{Operation::Arm}));
    assert(controller.arm_error() == "none");
    assert(controller.apply(Command{Operation::Arm})); // Duplicate authenticated ARM is idempotent.
    assert(controller.arm_error() == "none");
    assert(controller.armed() && roll_override_value == 1 && pitch_override_value == 1);
    assert(controller.apply(Command{Operation::Control, 1, 0.3f, -0.4f}));
    assert(roll_value == 0.3f && pitch_value == -0.4f);
    assert(!controller.apply(Command{Operation::Control, 1, 0, 0}));
    assert(controller.apply(Command{Operation::Throttle, 0, 0, 0, 0.6f}));
    assert(throttle_value == 0.6f);
    assert(controller.apply(Command{Operation::Action, 0, 0, 0, 0, "trim-up"}));
    assert(executed_commands == 1);
    controller.release();
    assert(!controller.armed() && roll_override_value == 0 && pitch_override_value == 0 && roll_value == 0 && pitch_value == 0);
    assert(controller.apply(Command{Operation::Arm}));
    std::this_thread::sleep_for(std::chrono::milliseconds(385));
    controller.tick();
    assert(!controller.armed() && roll_override_value == 0 && pitch_override_value == 0);
    std::cout << "Control tests passed\n";
}
