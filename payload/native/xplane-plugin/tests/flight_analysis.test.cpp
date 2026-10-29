#include "xmc/flight_analysis.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <chrono>
#include <string>
#include <vector>
using namespace std::chrono_literals;
using Clock = xmc::FlightAnalysis::Clock;

struct Case {
    const char* name;
    std::string overrides;
    unsigned flag;
    int frames = 3;
};

static xmc::AnalysisResult feed(xmc::FlightAnalysis& monitor, const std::string& fields,
                                Clock::time_point start, int frames) {
    xmc::AnalysisResult result;
    for (int i = 0; i < frames; ++i)
        result = monitor.process("XMT1|token|armed=0|" + fields, start + i * 100ms);
    return result;
}

int main() {
    const auto start = Clock::now();
    const std::string normal = "onGround=0|aglFeet=5000|rollDegrees=4|altitudeFeet=6000|"
                               "indicatedAirspeedKnots=160|speedVneKnots=200|speedVsKnots=60|verticalSpeedFpm=-400";
    xmc::FlightAnalysis monitor;
    auto result = feed(monitor, normal, start, 5);
    assert(result.alerts == 0 && result.risk_score == 0);
    assert(result.sample_count == 5);
    const auto over = feed(monitor, normal + "|indicatedAirspeedKnots=245", start + 600ms, 3);
    // Duplicate field names are ignored after the first value. The actual native
    // protocol parser rejects duplicates. Test with a clean generated snapshot.
    assert(over.alerts == 0);
    monitor.reset();

    const std::vector<Case> cases{
        {"overspeed", "onGround=0|aglFeet=3000|indicatedAirspeedKnots=240|speedVneKnots=190", 0},
        {"stall margin", "onGround=0|aglFeet=3000|indicatedAirspeedKnots=55|speedVsKnots=60", 1},
        {"bank", "onGround=0|aglFeet=3000|rollDegrees=56", 2},
        {"terrain descent", "onGround=0|aglFeet=400|verticalSpeedFpm=-1800", 3},
        {"engine split", "onGround=0|aglFeet=3000|throttleRatio=0.9|n1LeftPercent=85|n1RightPercent=45", 4},
        {"gear transit prolonged", "onGround=0|aglFeet=900|gearHandleDown=1|gearDeploy0Ratio=1|gearDeploy1Ratio=0|gearDeploy2Ratio=1", 5, 30},
        {"electrical", "onGround=0|aglFeet=3000|electricalBusVolts=14", 6},
        {"hydraulics", "onGround=0|aglFeet=3000|hydraulicPressurePsi=800", 7},
        {"cabin", "onGround=0|aglFeet=11000|cabinAltitudeFeet=11500", 8},
        {"ice", "onGround=0|aglFeet=3000|wingIceRatio=0.2|wingAntiIceOn=0|pitotHeatOn=0", 9},
        {"unstable approach", "onGround=0|aglFeet=800|verticalSpeedFpm=-1400", 10},
    };
    for (const auto& item : cases) {
        monitor.reset();
        result = feed(monitor, item.overrides, start, item.frames - 1);
        assert(result.alerts == 0);
        result = feed(monitor, item.overrides, start + item.frames * 100ms, 1);
        assert(result.alerts & (1u << item.flag));
        assert(result.risk_score > 0 && result.event_count >= 1);
        assert(result.append_fields().find("nativeAlertFlags=") != std::string::npos);
        result = feed(monitor, "onGround=1|aglFeet=0", start + 6s, 5);
        assert(result.alerts == 0 && result.event_count >= 1);
    }
    monitor.reset();
    result = feed(monitor, "", start, 5);
    assert(result.alerts == 0 && result.risk_score == 0);
    // Lack of DataRefs never means low pressure or low voltage.
    monitor.reset();
    for (int i = 0; i < 9200; ++i) {
        result = monitor.process("XMT1|token|armed=0|onGround=1|aglFeet=0|rollDegrees=3|altitudeFeet=5000|indicatedAirspeedKnots=100",
                                 start + i*100ms);
    }
    assert(result.sample_count == 9000); // Bounded memory.
    assert(result.bank_rms_degrees && *result.bank_rms_degrees > 2.99);
    assert(result.airspeed_trend_knots_min && *result.airspeed_trend_knots_min == 0);
    assert(result.altitude_trend_fpm && *result.altitude_trend_fpm == 0);
}
