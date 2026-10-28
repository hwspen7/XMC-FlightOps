#include "xmc/latest_control.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <iostream>

int main() {
    using namespace xmc;
    LatestControl batch;
    assert(!batch.has_pending());
    assert(!batch.take().has_value());
    batch.offer(Command{Operation::Arm});
    batch.offer(Command{Operation::Throttle, 0, 0, 0, 0.3f});
    assert(!batch.has_pending()); // Discrete commands are never swallowed.

    batch.offer(Command{Operation::Control, 5, -0.2f, 0.4f});
    batch.offer(Command{Operation::Control, 6, 0.6f, -0.3f});
    batch.offer(Command{Operation::Control, 4, -0.9f, 0.1f}); // Old UDP packet.
    const auto newest = batch.take();
    assert(newest && newest->sequence == 6);
    assert(newest->roll == 0.6f && newest->pitch == -0.3f);
    assert(!batch.has_pending());

    batch.offer(Command{Operation::Control, 7, 0.7f, 0.8f});
    batch.discard(); // DISARM/ARM barrier prevents stale commands crossing ownership.
    assert(!batch.take());
    batch.offer(Command{Operation::Control, 0, 0.0f, 0.0f});
    const auto first = batch.take();
    assert(first && first->sequence == 0);
    std::cout << "Latest control tests passed\n";
}
