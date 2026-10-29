#include "xmc/flight_phase.hpp"
#include <cassert>
#include <chrono>
int main(){using namespace std::chrono_literals;using C=xmc::PhaseAnalysis::Clock;
 xmc::PhaseAnalysis a;const auto start=C::now();
 const xmc::PhaseInput cruise{0,12000,235,0};
 assert(a.update(cruise,start)==xmc::FlightPhase::Unknown);
 assert(a.update(cruise,start+100ms)==xmc::FlightPhase::Unknown);
 assert(a.update(cruise,start+300ms)==xmc::FlightPhase::Cruise);
 const xmc::PhaseInput approach{0,700,145,-750};
 assert(a.update(approach,start+400ms)==xmc::FlightPhase::Cruise);
 assert(a.update(approach,start+800ms)==xmc::FlightPhase::Cruise);
 assert(a.update(approach,start+1000ms)==xmc::FlightPhase::Approach);
 a.reset();assert(a.current()==xmc::FlightPhase::Unknown);
 const xmc::PhaseInput missing{};assert(a.update(missing,start)==xmc::FlightPhase::Unknown);
}
