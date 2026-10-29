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
float speed_vs = 74.0f;
float normal_g = 1.17f;
float egt_pair[2] = {585.f, 598.f};
float selected_alt = 6000.0f;
int flap_detents = 9;
float flap_handle = 0.375f;
float flap_actual = 0.22f;
float gear_ratios[3] = {1.0f, 0.55f, 0.0f};
char aircraft_icao[] = "B738";
}
XPLMDataRef XPLMFindDataRef(const char* name) {
    if (std::strcmp(name, "sim/aircraft/view/acf_Vs") == 0) return &speed_vs;
    if (std::strcmp(name, "sim/flightmodel2/misc/gforce_normal") == 0) return &normal_g;
    if (std::strcmp(name, "sim/cockpit2/engine/indicators/EGT_deg_C") == 0) return egt_pair;
    if (std::strcmp(name, "sim/cockpit2/autopilot/altitude_dial_ft") == 0) return &selected_alt;
    if (std::strcmp(name, "sim/aircraft/controls/acf_flap_detents") == 0) return &flap_detents;
    if (std::strcmp(name, "sim/cockpit2/controls/flap_handle_request_ratio") == 0) return &flap_handle;
    if (std::strcmp(name, "sim/cockpit2/controls/flap_system_deploy_ratio") == 0) return &flap_actual;
    if (std::strcmp(name, "sim/aircraft/view/acf_ICAO") == 0) return aircraft_icao;
    if (std::strcmp(name, "sim/flightmodel2/gear/deploy_ratio") == 0) return gear_ratios;
    if (std::strcmp(name, "sim/joystick/yoke_roll_ratio") == 0) return &raw_roll;
    if (std::strcmp(name, "sim/cockpit2/controls/yoke_roll_ratio") == 0) return &pilot_roll;
    if (std::strcmp(name, "sim/cockpit2/controls/total_roll_ratio") == 0) return &total_roll;
    if (std::strcmp(name, "sim/operation/override/override_joystick_roll") == 0) return &override_roll;
    return nullptr;
}
int XPLMGetDataRefTypes(XPLMDataRef ref) { return ref == &override_roll || ref == &flap_detents ? xplmType_Int : ref == aircraft_icao ? xplmType_Data : (ref == gear_ratios || ref == egt_pair) ? xplmType_FloatArray : xplmType_Float; }
int XPLMGetDatai(XPLMDataRef ref) { return *static_cast<int*>(ref); }
float XPLMGetDataf(XPLMDataRef ref) { return *static_cast<float*>(ref); }
double XPLMGetDatad(XPLMDataRef) { return 0.0; }
int XPLMGetDatavf(XPLMDataRef ref, float* out, int index, int count) {
    if (!out || count != 1 || index < 0 || (ref != gear_ratios && ref != egt_pair)) return 0;
    if (ref == gear_ratios && index >= 3) return 0;
    if (ref == egt_pair && index >= 2) return 0;
    *out = ref == gear_ratios ? gear_ratios[index] : egt_pair[index];
    return 1;
}
int XPLMGetDatab(XPLMDataRef ref, void* out, int offset, int max) { if (ref != aircraft_icao || offset != 0 || max < 5) return 0; std::memcpy(out, aircraft_icao, 5); return 5; }

int main() {
    xmc::Telemetry telemetry;
    telemetry.resolve();
    const std::string snapshot = telemetry.packet("aaaaaaaaaaaaaaaa", true);
    assert(snapshot.find("|normalLoadG=1.17") != std::string::npos);
    assert(snapshot.find("|egtLeftC=585") != std::string::npos);
    assert(snapshot.find("|egtRightC=598") != std::string::npos);
    assert(snapshot.find("|n2LeftPercent=") == std::string::npos);
    assert(snapshot.find("|aircraftIcao=B738") != std::string::npos);
    assert(snapshot.find("|speedVsKnots=74") != std::string::npos);
    assert(snapshot.find("|selectedAltitudeFeet=6000") != std::string::npos);
    assert(snapshot.find("|flapDetentCount=9") != std::string::npos);
    assert(snapshot.find("|flapHandleRatio=0.375") != std::string::npos);
    assert(snapshot.find("|flapDeployRatio=0.22") != std::string::npos);
    assert(snapshot.find("|gearDeploy0Ratio=1") != std::string::npos);
    assert(snapshot.find("|gearDeploy1Ratio=0.55") != std::string::npos);
    assert(snapshot.find("|gearDeploy2Ratio=0") != std::string::npos);
    assert(snapshot.find("|simJoystickRollRatio=0.2") != std::string::npos);
    assert(snapshot.find("|cockpitYokeRollRatio=0.15") != std::string::npos);
    assert(snapshot.find("|effectiveRollRatio=0.45") != std::string::npos);
    assert(snapshot.find("|rollOverrideState=1") != std::string::npos);
    assert(snapshot.find("|cockpitYokePitchRatio=") == std::string::npos);
    std::cout << "Telemetry tests passed\n";
}
