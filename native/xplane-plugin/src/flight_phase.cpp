#include "xmc/flight_phase.hpp"
#include <cmath>
namespace xmc {
FlightPhase PhaseAnalysis::update(const PhaseInput& in, Clock::time_point now) {
 FlightPhase candidate=FlightPhase::Unknown;
 const auto good=[](const std::optional<double>& x){return x&&std::isfinite(*x);};
 if(good(in.on_ground)) {
  if(*in.on_ground > .5) candidate=good(in.indicated_airspeed_knots)&&*in.indicated_airspeed_knots>=45?FlightPhase::Takeoff:FlightPhase::Ground;
  else if(good(in.agl_feet)&&good(in.vertical_speed_fpm)) {
   const auto agl=*in.agl_feet, vs=*in.vertical_speed_fpm;
   if(agl<150&&vs< -100) candidate=FlightPhase::Landing;
   else if(agl<1800&&vs< -150) candidate=FlightPhase::Approach;
   else if(vs>300) candidate=FlightPhase::Climb;
   else if(vs< -300) candidate=FlightPhase::Descent;
   else if(agl>1800) candidate=FlightPhase::Cruise;
  }
 }
 if(candidate==current_){pending_=candidate;consecutive_=0;return current_;}
 if(candidate!=pending_){pending_=candidate;candidate_since_=now;consecutive_=1;}
 else ++consecutive_;
 // Both sample-count and elapsed time are required to reject noisy transitions.
 if(consecutive_>=3&&now>=candidate_since_&&now-candidate_since_>=std::chrono::milliseconds(250)) {
  current_=candidate;consecutive_=0;
 }
 return current_;
}
void PhaseAnalysis::reset(){current_=FlightPhase::Unknown;pending_=FlightPhase::Unknown;candidate_since_={};consecutive_=0;}
} // namespace xmc
