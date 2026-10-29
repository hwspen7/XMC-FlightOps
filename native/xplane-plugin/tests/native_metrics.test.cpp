#include "xmc/native_metrics.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <chrono>
#include <iostream>
#include <string>

using namespace std::chrono_literals;
int main() {
    xmc::NativeMetrics metrics;
    const auto t0 = xmc::NativeMetrics::Clock::now();
    // Flight-loop statistics use the native monotonic clock and do not affect control.
    for (int i = 0; i <= 120; ++i) metrics.on_flight_loop(t0 + i * 10ms);
    assert(metrics.loop_hz() >= 90 && metrics.loop_hz() <= 110);
    std::string idle = "XMT1|token|armed=0";
    metrics.append_telemetry(idle, t0 + 1300ms);
    assert(idle.find("nativeLoopHz=") != std::string::npos);
    assert(idle.find("nativeAckSeq=") == std::string::npos);

    metrics.on_arm();
    std::string not_yet = "XMT1|token|armed=1";
    metrics.append_telemetry(not_yet, t0);
    assert(not_yet.find("nativeAppliedFrames=0") != std::string::npos);
    assert(not_yet.find("nativeAckSeq=") == std::string::npos);

    metrics.on_control_applied(0, t0 + 1500ms, t0 + 1500ms + 175us);
    metrics.on_control_applied(1, t0 + 1530ms, t0 + 1530ms + 350us);
    metrics.on_control_applied(1, t0 + 1540ms, t0 + 1540ms + 999us); // replay ignored
    metrics.on_control_applied(4, t0 + 1570ms, t0 + 1570ms + 200us); // two missing sequence values
    assert(metrics.applied_frames() == 3);
    assert(metrics.skipped_sequences() == 2);
    assert(metrics.ack_sequence() == 4);
    assert(metrics.max_apply_us() == 350);
    assert(metrics.max_frame_gap_ms() >= 39 && metrics.max_frame_gap_ms() <= 40);
    std::string active = "XMT1|token|armed=1";
    metrics.append_telemetry(active, t0 + 1590ms);
    assert(active.find("nativeAckSeq=4") != std::string::npos);
    assert(active.find("nativeControlAgeMs=19") != std::string::npos);
    assert(active.find("nativeSkippedSeq=2") != std::string::npos);

    metrics.on_disarm();
    std::string disarmed = "XMT1|token|armed=0";
    metrics.append_telemetry(disarmed, t0 + 1600ms);
    assert(disarmed.find("nativeAckSeq=") == std::string::npos);
    metrics.on_arm();
    assert(metrics.applied_frames() == 0);
    metrics.on_control_applied(0, t0 + 1700ms, t0 + 1700ms + 10us);
    assert(metrics.ack_sequence() == 0);
    assert(metrics.skipped_sequences() == 0);
    std::cout << "Native metrics tests passed\n";
}
