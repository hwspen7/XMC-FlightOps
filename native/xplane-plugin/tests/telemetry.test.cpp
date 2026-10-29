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
int flap_detents = 9;
float flap_handle = 0.375f;
float flap_actual = 0.22f;
char aircraft_icao[] = "B738";
}
XPLMDataRef XPLMFindDataRef(const char* name) {
    if (std::strcmp(name, "sim/aircraft/controls/acf_flap_detents") == 0) return &flap_detents;
    if (std::strcmp(name, "sim/cockpit2/controls/flap_handle_request_ratio") == 0) return &flap_handle;
    if (std::strcmp(name, "sim/cockpit2/controls/flap_system_deploy_ratio") == 0) return &flap_actual;
    if (std::strcmp(name, "sim/aircraft/view/acf_ICAO") == 0) return aircraft_icao;
    if (std::strcmp(name, "sim/joystick/yoke_roll_ratio") == 0) return &raw_roll;
    if (std::strcmp(name, "sim/cockpit2/controls/yoke_roll_ratio") == 0) return &pilot_roll;
    if (std::strcmp(name, "sim/cockpit2/controls/total_roll_ratio") == 0) return &total_roll;
    if (std::strcmp(name, "sim/operation/override/override_joystick_roll") == 0) return &override_roll;
    return nullptr;
}
int XPLMGetDataRefTypes(XPLMDataRef ref) { return ref == &override_roll || ref == &flap_detents ? xplmType_Int : ref == aircraft_icao ? xplmType_Data : xplmType_Float; }
int XPLMGetDatai(XPLMDataRef ref) { return *static_cast<int*>(ref); }
float XPLMGetDataf(XPLMDataRef ref) { return *static_cast<float*>(ref); }
double XPLMGetDatad(XPLMDataRef) { return 0.0; }
int XPLMGetDatavf(XPLMDataRef, float*, int, int) { return 0; }
int XPLMGetDatab(XPLMDataRef ref, void* out, int offset, int max) { if (ref != aircraft_icao || offset != 0 || max < 5) return 0; std::memcpy(out, aircraft_icao, 5); return 5; }

int main() {
    xmc::Telemetry telemetry;
    telemetry.resolve();
    const std::string snapshot = telemetry.packet("aaaaaaaaaaaaaaaa", true);
    assert(snapshot.find("|aircraftIcao=B738") != std::string::npos);
    assert(snapshot.find("|flapDetentCount=9") != std::string::npos);
    assert(snapshot.find("|flapHandleRatio=0.375") != std::string::npos);
    assert(snapshot.find("|flapDeployRatio=0.22") != std::string::npos);
    assert(snapshot.find("|simJoystickRollRatio=0.2") != std::string::npos);
    assert(snapshot.find("|cockpitYokeRollRatio=0.15") != std::string::npos);
    assert(snapshot.find("|effectiveRollRatio=0.45") != std::string::npos);
    assert(snapshot.find("|rollOverrideState=1") != std::string::npos);
    assert(snapshot.find("|cockpitYokePitchRatio=") == std::string::npos);
    std::cout << "Telemetry tests passed\n";
}
