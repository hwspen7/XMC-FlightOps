#include "xmc/flight_analysis.hpp"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <unordered_map>

namespace xmc {
namespace {
using Values = std::unordered_map<std::string_view, double>;
Values parse(std::string_view packet) {
    Values values;
    std::size_t pos = 0;
    while (pos < packet.size()) {
        const auto end = packet.find('|', pos);
        const auto part = packet.substr(pos, end == std::string_view::npos ? end : end - pos);
        const auto eq = part.find('=');
        if (eq != std::string_view::npos && eq > 0 && part.size() - eq <= 40) {
            const auto key = part.substr(0, eq);
            std::string value(part.substr(eq + 1));
            char* last = nullptr;
            const double number = std::strtod(value.c_str(), &last);
            if (last != value.c_str() && *last == '\0' && std::isfinite(number)) values.emplace(key, number);
        }
        if (end == std::string_view::npos) break;
        pos = end + 1;
    }
    return values;
}
std::optional<double> get(const Values& values, std::string_view key) {
    const auto it = values.find(key);
    return it == values.end() ? std::nullopt : std::optional<double>{it->second};
}
bool greater(const Values& v, std::string_view key, double threshold) {
    const auto value = get(v, key);
    return value && *value > threshold;
}
bool less(const Values& v, std::string_view key, double threshold) {
    const auto value = get(v, key);
    return value && *value < threshold;
}
void append_number(std::string& line, std::string_view field, double value) {
    char buffer[48]{};
    std::snprintf(buffer, sizeof(buffer), "%.4f", value);
    line += '|';
    line += field;
    line += '=';
    line += buffer;
}
constexpr std::array<int, 11> weights{18, 20, 10, 24, 15, 15, 16, 16, 12, 12, 14};
} // namespace

std::string AnalysisResult::append_fields() const {
    std::string result;
    append_number(result, "nativeRiskScore", risk_score);
    append_number(result, "nativeAlertFlags", alerts);
    append_number(result, "nativeEventCount", event_count);
    append_number(result, "nativeAnalysisSamples", sample_count);
    if (airspeed_trend_knots_min) append_number(result, "nativeIasTrendKtMin", *airspeed_trend_knots_min);
    if (altitude_trend_fpm) append_number(result, "nativeAltitudeTrendFpm", *altitude_trend_fpm);
    if (bank_rms_degrees) append_number(result, "nativeBankRmsDegrees", *bank_rms_degrees);
    return result;
}

AnalysisResult FlightAnalysis::process(std::string_view packet, Clock::time_point now) {
    const auto v = parse(packet);
    auto ias = get(v, "indicatedAirspeedKnots");
    auto agl = get(v, "aglFeet");
    auto bank = get(v, "rollDegrees");
    auto alt = get(v, "altitudeFeet");
    const bool airborne = greater(v, "onGround", -0.5) && less(v, "onGround", 0.5) && agl && *agl > 20;
    const double speed = ias.value_or(0);
    const auto flap = get(v, "flapDeployRatio");
    const auto stall = (flap && *flap > 0.3) ? get(v, "speedVsoKnots") : get(v, "speedVsKnots");
    const auto vne = get(v, "speedVneKnots");
    const auto n1l = get(v, "n1LeftPercent");
    const auto n1r = get(v, "n1RightPercent");
    const auto gear = get(v, "gearHandleDown");
    const auto g0 = get(v, "gearDeploy0Ratio");
    const auto g1 = get(v, "gearDeploy1Ratio");
    const auto g2 = get(v, "gearDeploy2Ratio");
    const auto cabin = get(v, "cabinAltitudeFeet");
    const auto hydraulic_fluid = get(v, "hydraulicFluid1Ratio");
    const auto bus = get(v, "electricalBusVolts");
    const auto wing_ice = get(v, "wingIceRatio");
    const auto anti_ice = get(v, "wingAntiIceOn");
    const auto pitot = get(v, "pitotHeatOn");
    const auto vsi = get(v, "verticalSpeedFpm");
    const bool have_gear = gear && g0 && g1 && g2;
    const bool gear_conflict = have_gear && (*gear > 0.5
        ? (*g0 < 0.9 || *g1 < 0.9 || *g2 < 0.9)
        : (*g0 > 0.1 || *g1 > 0.1 || *g2 > 0.1));
    const bool on_approach = airborne && agl && *agl > 200 && *agl < 1000;
    const std::array<bool, 11> symptoms{
        airborne && vne && *vne > 50 && speed > *vne,
        airborne && agl && *agl > 100 && stall && *stall > 30 && speed > 25 && speed < *stall * 1.1,
        airborne && bank && std::fabs(*bank) > 50,
        airborne && agl && *agl < 500 && vsi && *vsi < -1500,
        airborne && n1l && n1r && greater(v, "throttleRatio", 0.5) &&
            std::max(*n1l, *n1r) > 35 && std::fabs(*n1l - *n1r) > 25,
        airborne && agl && *agl < 2500 && gear_conflict,
        airborne && bus && *bus >= 0 && *bus < 19,
        airborne && hydraulic_fluid && *hydraulic_fluid >= 0 && *hydraulic_fluid < 0.15,
        airborne && agl && *agl > 2500 && cabin && *cabin > 10000,
        airborne && wing_ice && *wing_ice > 0.1 && anti_ice && pitot && *anti_ice < 0.5 && *pitot < 0.5,
        on_approach && ((vsi && (*vsi < -1300 || *vsi > 500)) || (bank && std::fabs(*bank) > 30))
    };
    // Three consecutive indications to raise (30 for gear); five to clear.
    // Brief spikes cannot create a flood of events on the browser or server.
    for (std::size_t i = 0; i < symptoms.size(); ++i) {
        const std::uint32_t mask = 1u << i;
        if (symptoms[i]) {
            // Gear actuators require settling time after an intentional handle move.
            const unsigned assert_samples = i == 5 ? 30u : 3u;
            present_[i] = std::min(present_[i] + 1, assert_samples);
            absent_[i] = 0;
            if (present_[i] >= assert_samples && !(active_ & mask)) { active_ |= mask; ++event_count_; }
        } else {
            absent_[i] = std::min(absent_[i] + 1, 5u);
            present_[i] = 0;
            if (absent_[i] >= 5) active_ &= ~mask;
        }
    }
    history_.push_back({now, ias, alt, bank});
    // Strict bounded 15-minute history; memory consumption remains predictable.
    while (history_.size() > 9000 || (!history_.empty() && now - history_.front().at > std::chrono::minutes(15)))
        history_.pop_front();

    AnalysisResult result;
    result.alerts = active_;
    result.event_count = event_count_;
    result.sample_count = static_cast<int>(history_.size());
    for (std::size_t i = 0; i < weights.size(); ++i)
        if (active_ & (1u << i)) result.risk_score += weights[i];
    result.risk_score = std::min(result.risk_score, 100);
    if (!history_.empty()) {
        double sum_squares = 0;
        int valid_bank = 0;
        for (auto it = history_.rbegin(); it != history_.rend(); ++it) {
            if (now - it->at > std::chrono::seconds(30)) break;
            if (it->bank) { sum_squares += *it->bank * *it->bank; ++valid_bank; }
        }
        if (valid_bank) result.bank_rms_degrees = std::sqrt(sum_squares / valid_bank);
        const auto calc = [&](bool airspeed) -> std::optional<double> {
            const auto latest = airspeed ? ias : alt;
            if (!latest) return std::nullopt;
            for (auto it = history_.rbegin(); it != history_.rend(); ++it) {
                if (now - it->at < std::chrono::seconds(10)) continue;
                const auto previous = airspeed ? it->ias : it->altitude;
                if (!previous) continue;
                const double minutes = std::chrono::duration<double>(now - it->at).count() / 60.0;
                if (minutes <= 0.0) return std::nullopt;
                return (*latest - *previous) / minutes;
            }
            return std::nullopt;
        };
        result.airspeed_trend_knots_min = calc(true);
        result.altitude_trend_fpm = calc(false);
    }
    return result;
}
void FlightAnalysis::reset() {
    history_.clear(); present_.fill(0); absent_.fill(0); active_ = 0; event_count_ = 0;
}
} // namespace xmc
