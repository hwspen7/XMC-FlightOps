#include "xmc/telemetry.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cmath>
#include <cstring>
#include <iostream>
#include <string>

namespace {
float raw_roll = 0.2f;
float pilot_roll = 0.15f;
float total_roll = 0.45f;
int override_roll = 1;
}
XPLMDataRef XPLMFindDataRef(const char* name) {
    if (std::strcmp(name, "sim/joystick/yoke_roll_ratio") == 0) return &raw_roll;
    if (std::strcmp(name, "sim/cockpit2/controls/yoke_roll_ratio") == 0) return &pilot_roll;
    if (std::strcmp(name, "sim/cockpit2/controls/total_roll_ratio") == 0) return &total_roll;
    if (std::strcmp(name, "sim/operation/override/override_joystick_roll") == 0) return &override_roll;
    return nullptr;
}
int XPLMGetDataRefTypes(XPLMDataRef ref) { return ref == &override_roll ? xplmType_Int : xplmType_Float; }
int XPLMGetDatai(XPLMDataRef ref) { return *static_cast<int*>(ref); }
float XPLMGetDataf(XPLMDataRef ref) { return *static_cast<float*>(ref); }
double XPLMGetDatad(XPLMDataRef) { return 0.0; }
int XPLMGetDatavf(XPLMDataRef, float*, int, int) { return 0; }

int main() {
    xmc::Telemetry telemetry;
    telemetry.resolve();
    const std::string snapshot = telemetry.packet("aaaaaaaaaaaaaaaa", true);
    assert(snapshot.find("|simJoystickRollRatio=0.2") != std::string::npos);
    assert(snapshot.find("|cockpitYokeRollRatio=0.15") != std::string::npos);
    assert(snapshot.find("|effectiveRollRatio=0.45") != std::string::npos);
    assert(snapshot.find("|rollOverrideState=1") != std::string::npos);
    assert(snapshot.find("|cockpitYokePitchRatio=") == std::string::npos);
    std::cout << "Telemetry tests passed\n";
}
