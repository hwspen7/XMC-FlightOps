#pragma once
#include <chrono>
#include <optional>
namespace xmc {
// Advisory flight phase, not an operational flight-management mode.
enum class FlightPhase : int { Unknown=0, Ground=1, Takeoff=2, Climb=3, Cruise=4, Descent=5, Approach=6, Landing=7 };
struct PhaseInput {
 std::optional<double> on_ground, agl_feet, indicated_airspeed_knots, vertical_speed_fpm;
};
class PhaseAnalysis {
public:
 using Clock=std::chrono::steady_clock;
 FlightPhase update(const PhaseInput& in, Clock::time_point now);
 FlightPhase current() const {return current_;}
 void reset();
private:
 FlightPhase current_=FlightPhase::Unknown, pending_=FlightPhase::Unknown;
 Clock::time_point candidate_since_{};
 unsigned consecutive_=0;
};
} // namespace xmc
