#pragma once
#include <array>
#include "xmc/flight_phase.hpp"
#include <chrono>
#include <cstdint>
#include <deque>
#include <optional>
#include <string>
#include <string_view>

namespace xmc {
// Read-only, aircraft-agnostic advisory monitoring. Never writes a DataRef.
// Bit definitions are part of the wire protocol; keep in sync with the web UI.
enum class FlightAlert : std::uint32_t {
    Overspeed = 1u << 0,
    LowSpeed = 1u << 1,
    ExcessiveBank = 1u << 2,
    TerrainDescent = 1u << 3,
    EngineAsymmetry = 1u << 4,
    GearDisagreement = 1u << 5,
    ElectricalLow = 1u << 6,
    HydraulicLow = 1u << 7,
    CabinAltitude = 1u << 8,
    IcingExposure = 1u << 9,
    UnstableApproach = 1u << 10,
};

struct AnalysisResult {
    std::uint32_t alerts = 0;
    int risk_score = 0;
    int handling_risk = 0, propulsion_risk = 0, systems_risk = 0, approach_risk = 0;
    int phase = 0;
    int event_count = 0;
    int sample_count = 0;
    std::optional<double> airspeed_trend_knots_min;
    std::optional<double> altitude_trend_fpm;
    std::optional<double> bank_rms_degrees;
    std::string append_fields() const;
};

class FlightAnalysis {
public:
    using Clock = std::chrono::steady_clock;
    AnalysisResult process(std::string_view native_packet, Clock::time_point now);
    void reset();
private:
    struct Sample {
        Clock::time_point at;
        std::optional<double> ias;
        std::optional<double> altitude;
        std::optional<double> bank;
    };
    PhaseAnalysis phase_analysis_;
    std::deque<Sample> history_;
    std::array<unsigned, 11> present_{};
    std::array<unsigned, 11> absent_{};
    std::uint32_t active_ = 0;
    int event_count_ = 0;
};
} // namespace xmc
