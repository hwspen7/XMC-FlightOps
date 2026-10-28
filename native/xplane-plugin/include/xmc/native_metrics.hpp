#pragma once

#include <chrono>
#include <cstdint>
#include <string>

namespace xmc {

// Small, allocation-free-per-frame counters owned by the X-Plane flight-loop thread.
// All durations use one native monotonic clock. No cross-machine clock subtraction.
class NativeMetrics {
public:
    using Clock = std::chrono::steady_clock;
    using TimePoint = Clock::time_point;

    void on_flight_loop(TimePoint now) noexcept;
    void on_arm() noexcept;
    void on_disarm() noexcept;
    void on_control_applied(std::uint64_t sequence, TimePoint started, TimePoint finished) noexcept;
    void append_telemetry(std::string& packet, TimePoint now) const;

    std::uint32_t loop_hz() const noexcept { return loop_hz_; }
    std::uint64_t applied_frames() const noexcept { return applied_frames_; }
    std::uint64_t skipped_sequences() const noexcept { return skipped_sequences_; }
    std::uint32_t max_frame_gap_ms() const noexcept { return max_frame_gap_ms_; }
    std::uint32_t max_apply_us() const noexcept { return max_apply_us_; }
    bool has_ack() const noexcept { return has_ack_; }
    bool active() const noexcept { return armed_; }
    std::uint64_t ack_sequence() const noexcept { return ack_sequence_; }

private:
    static std::uint32_t bounded_ms(TimePoint begin, TimePoint end) noexcept;
    static std::uint32_t bounded_us(TimePoint begin, TimePoint end) noexcept;
    bool armed_ = false;
    bool has_ack_ = false;
    std::uint64_t ack_sequence_ = 0;
    std::uint64_t applied_frames_ = 0;
    std::uint64_t skipped_sequences_ = 0;
    std::uint32_t max_frame_gap_ms_ = 0;
    std::uint32_t max_apply_us_ = 0;
    TimePoint last_control_{};
    TimePoint previous_loop_{};
    TimePoint loop_window_start_{};
    std::uint32_t loop_window_count_ = 0;
    std::uint32_t loop_hz_ = 0;
};
} // namespace xmc
