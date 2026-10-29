#include "xmc/native_metrics.hpp"

#include <algorithm>
#include <limits>

namespace xmc {
namespace {
constexpr std::uint32_t kMaxGapMs = 60'000;
constexpr std::uint32_t kMaxProcessingUs = 1'000'000;
constexpr std::uint64_t kMaxCount = 1'000'000'000;
}

std::uint32_t NativeMetrics::bounded_ms(TimePoint begin, TimePoint end) noexcept {
    if (begin == TimePoint{} || end < begin) return 0;
    const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(end - begin).count();
    return static_cast<std::uint32_t>(std::min<std::int64_t>(kMaxGapMs, elapsed));
}

std::uint32_t NativeMetrics::bounded_us(TimePoint begin, TimePoint end) noexcept {
    if (end < begin) return 0;
    const auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(end - begin).count();
    return static_cast<std::uint32_t>(std::min<std::int64_t>(kMaxProcessingUs, elapsed));
}

void NativeMetrics::on_flight_loop(TimePoint now) noexcept {
    if (loop_window_start_ == TimePoint{}) loop_window_start_ = now;
    if (loop_window_count_ < 10'000) ++loop_window_count_;
    const auto window_ms = bounded_ms(loop_window_start_, now);
    if (window_ms >= 1000) {
        loop_hz_ = std::min<std::uint32_t>(1000, static_cast<std::uint32_t>(
            static_cast<std::uint64_t>(loop_window_count_) * 1000 / window_ms));
        loop_window_start_ = now;
        loop_window_count_ = 0;
    }
    previous_loop_ = now;
}

void NativeMetrics::on_arm() noexcept {
    armed_ = true;
    has_ack_ = false;
    ack_sequence_ = 0;
    applied_frames_ = 0;
    skipped_sequences_ = 0;
    max_frame_gap_ms_ = 0;
    max_apply_us_ = 0;
    last_control_ = TimePoint{};
}

void NativeMetrics::on_disarm() noexcept {
    armed_ = false;
    has_ack_ = false;
    last_control_ = TimePoint{};
}

void NativeMetrics::on_control_applied(std::uint64_t sequence, TimePoint started, TimePoint finished) noexcept {
    if (!armed_) return;
    if (has_ack_ && sequence <= ack_sequence_) return;
    if (has_ack_ && sequence - ack_sequence_ > 1 && skipped_sequences_ < kMaxCount) {
        const auto gap = sequence - ack_sequence_ - 1;
        skipped_sequences_ += std::min<std::uint64_t>(gap, kMaxCount - skipped_sequences_);
    }
    if (last_control_ != TimePoint{})
        max_frame_gap_ms_ = std::max(max_frame_gap_ms_, bounded_ms(last_control_, finished));
    max_apply_us_ = std::max(max_apply_us_, bounded_us(started, finished));
    last_control_ = finished;
    ack_sequence_ = sequence;
    has_ack_ = true;
    if (applied_frames_ < kMaxCount) ++applied_frames_;
}

void NativeMetrics::append_telemetry(std::string& packet, TimePoint now) const {
    packet += "|nativeLoopHz=" + std::to_string(loop_hz_);
    if (!armed_) return; // No stale control-session stats when disarmed.
    packet += "|nativeAppliedFrames=" + std::to_string(applied_frames_);
    packet += "|nativeSkippedSeq=" + std::to_string(skipped_sequences_);
    packet += "|nativeMaxGapMs=" + std::to_string(max_frame_gap_ms_);
    packet += "|nativeMaxApplyUs=" + std::to_string(max_apply_us_);
    if (has_ack_) {
        packet += "|nativeAckSeq=" + std::to_string(ack_sequence_);
        packet += "|nativeControlAgeMs=" + std::to_string(bounded_ms(last_control_, now));
    }
}
} // namespace xmc
