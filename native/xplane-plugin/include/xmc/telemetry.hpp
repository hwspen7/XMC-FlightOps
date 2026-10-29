#pragma once
#include <array>
#include <string>
#include <string_view>
#include "XPLMDataAccess.h"
namespace xmc {
class Telemetry {
public:
    void resolve();
    std::string packet(std::string_view token, bool armed) const;
private:
    struct Field {
        const char* key;
        const char* path;
        double scale;
        int array_index;
        XPLMDataRef reference = nullptr;
    };
    static constexpr std::size_t field_count = 67;
    XPLMDataRef aircraft_icao_ = nullptr;
    std::array<Field, field_count> fields_{{
        {"normalLoadG", "sim/flightmodel2/misc/gforce_normal", 1, -1},
        {"outsideAirTempC", "sim/cockpit2/temperature/outside_air_temp_degc", 1, -1},
        {"n2LeftPercent", "sim/cockpit2/engine/indicators/N2_percent", 1, 0},
        {"n2RightPercent", "sim/cockpit2/engine/indicators/N2_percent", 1, 1},
        {"egtLeftC", "sim/cockpit2/engine/indicators/EGT_deg_C", 1, 0},
        {"egtRightC", "sim/cockpit2/engine/indicators/EGT_deg_C", 1, 1},
        {"fuelFlowLeftKgS", "sim/cockpit2/engine/indicators/fuel_flow_kg_sec", 1, 0},
        {"fuelFlowRightKgS", "sim/cockpit2/engine/indicators/fuel_flow_kg_sec", 1, 1},
        {"oilPressureLeftPsi", "sim/cockpit2/engine/indicators/oil_pressure_psi", 1, 0},
        {"oilPressureRightPsi", "sim/cockpit2/engine/indicators/oil_pressure_psi", 1, 1},
        {"grossWeightKg", "sim/flightmodel/weight/m_total", 1, -1},
        {"fuelWeightKg", "sim/flightmodel/weight/m_fuel_total", 1, -1},

        {"rollDegrees", "sim/flightmodel/position/phi", 1, -1},
        {"pitchDegrees", "sim/flightmodel/position/theta", 1, -1},
        {"headingDegrees", "sim/flightmodel/position/psi", 1, -1},
        {"indicatedAirspeedKnots", "sim/flightmodel/position/indicated_airspeed", 1, -1},
        {"speedVsoKnots", "sim/aircraft/view/acf_Vso", 1, -1},
        {"speedVsKnots", "sim/aircraft/view/acf_Vs", 1, -1},
        {"speedVfeKnots", "sim/aircraft/view/acf_Vfe", 1, -1},
        {"speedVnoKnots", "sim/aircraft/view/acf_Vno", 1, -1},
        {"speedVneKnots", "sim/aircraft/view/acf_Vne", 1, -1},
        {"selectedAltitudeFeet", "sim/cockpit2/autopilot/altitude_dial_ft", 1, -1},
        {"groundSpeedKnots", "sim/flightmodel/position/groundspeed", 1.943844492, -1},
        {"altitudeFeet", "sim/flightmodel/position/elevation", 3.280839895, -1},
        {"verticalSpeedFpm", "sim/flightmodel/position/vh_ind_fpm", 1, -1},
        {"magneticHeadingDegrees", "sim/flightmodel/position/magpsi", 1, -1},
        {"trueAirspeedKnots", "sim/flightmodel/position/true_airspeed", 1.943844492, -1},
        {"aglFeet", "sim/flightmodel/position/y_agl", 3.280839895, -1},
        {"angleOfAttackDegrees", "sim/flightmodel/position/alpha", 1, -1},
        {"sideslipDegrees", "sim/flightmodel/position/beta", 1, -1},
        {"rollRateDegreesPerSecond", "sim/flightmodel/position/P", 1, -1},
        {"pitchRateDegreesPerSecond", "sim/flightmodel/position/Q", 1, -1},
        {"yawRateDegreesPerSecond", "sim/flightmodel/position/R", 1, -1},
        {"latitudeDegrees", "sim/flightmodel/position/latitude", 1, -1},
        {"longitudeDegrees", "sim/flightmodel/position/longitude", 1, -1},
        {"flightPathDegrees", "sim/flightmodel/position/vpath", 1, -1},
        {"machNumber", "sim/flightmodel/misc/machno", 1, -1},
        {"throttleRatio", "sim/cockpit2/engine/actuators/throttle_ratio_all", 1, -1},
        {"flapRatio", "sim/cockpit2/controls/flap_ratio", 1, -1},
        {"flapHandleRatio", "sim/cockpit2/controls/flap_handle_request_ratio", 1, -1},
        {"flapDeployRatio", "sim/cockpit2/controls/flap_system_deploy_ratio", 1, -1},
        {"flapDetentCount", "sim/aircraft/controls/acf_flap_detents", 1, -1},
        {"speedbrakeRatio", "sim/cockpit2/controls/speedbrake_ratio", 1, -1},
        {"elevatorTrimRatio", "sim/cockpit2/controls/elevator_trim", 1, -1},
        {"gearHandleDown", "sim/cockpit2/controls/gear_handle_down", 1, -1},
        {"gearDeploy0Ratio", "sim/flightmodel2/gear/deploy_ratio", 1, 0},
        {"gearDeploy1Ratio", "sim/flightmodel2/gear/deploy_ratio", 1, 1},
        {"gearDeploy2Ratio", "sim/flightmodel2/gear/deploy_ratio", 1, 2},
        {"autopilotServosOn", "sim/cockpit2/autopilot/servos_on", 1, -1},
        {"n1LeftPercent", "sim/cockpit2/engine/indicators/N1_percent", 1, 0},
        {"n1RightPercent", "sim/cockpit2/engine/indicators/N1_percent", 1, 1},
        {"simJoystickRollRatio", "sim/joystick/yoke_roll_ratio", 1, -1},
        {"simJoystickPitchRatio", "sim/joystick/yoke_pitch_ratio", 1, -1},
        {"cockpitYokeRollRatio", "sim/cockpit2/controls/yoke_roll_ratio", 1, -1},
        {"cockpitYokePitchRatio", "sim/cockpit2/controls/yoke_pitch_ratio", 1, -1},
        {"effectiveRollRatio", "sim/cockpit2/controls/total_roll_ratio", 1, -1},
        {"effectivePitchRatio", "sim/cockpit2/controls/total_pitch_ratio", 1, -1},
        {"rollOverrideState", "sim/operation/override/override_joystick_roll", 1, -1},
        {"pitchOverrideState", "sim/operation/override/override_joystick_pitch", 1, -1},
        {"rudderRatio", "sim/joystick/yoke_heading_ratio", 1, -1},
        {"rudderOverrideState", "sim/operation/override/override_joystick_heading", 1, -1},
        {"leftBrakeRatio", "sim/cockpit2/controls/left_brake_ratio", 1, -1},
        {"rightBrakeRatio", "sim/cockpit2/controls/right_brake_ratio", 1, -1},
        {"reverseHandleRatio", "sim/cockpit2/engine/actuators/throttle_jet_rev_ratio_all", 1, -1},
        {"onGround", "sim/flightmodel/failures/onground_any", 1, -1},
        {"autothrottleOn", "sim/cockpit2/autopilot/autothrottle_on", 1, -1},
        {"wheelBrakeRatio", "sim/cockpit2/controls/wheel_brake_ratio", 1, -1},
    }};
};
}  // namespace xmc
