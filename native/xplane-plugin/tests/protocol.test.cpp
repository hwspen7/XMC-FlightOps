#include "xmc/protocol.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cmath>
#include <iostream>
int main() {
    constexpr auto token = "A_ValidPrivateToken123";
    using namespace xmc;
    assert(valid_token(token));
    assert(!valid_token("short"));
    assert(!valid_token("REPLACE_WITH_RANDOM_SECRET_32_CHARACTERS"));
    assert(!parse_command("XMC1|wrong|ARM", token));
    assert(parse_command("XMC1|A_ValidPrivateToken123|ARM", token)->operation == Operation::Arm);
    assert(parse_command("XMC1|A_ValidPrivateToken123|DISARM", token)->operation == Operation::Disarm);
    const auto cmd = parse_command("XMC1|A_ValidPrivateToken123|CTRL|42|-0.3|0.6", token);
    assert(cmd && cmd->operation == Operation::Control && cmd->sequence == 42);
    assert(std::fabs(cmd->roll + 0.3f) < 0.001f);
    assert(!parse_command("XMC1|A_ValidPrivateToken123|CTRL|5|1.9|0", token));
    assert(!parse_command("XMC1|A_ValidPrivateToken123|CTRL|-5|0|0", token));
    assert(!parse_command("XMC1|A_ValidPrivateToken123|CTRL|4|nan|0", token));
    assert(!parse_command("XMC1|A_ValidPrivateToken123|ACTION|invalid", token));
    assert(parse_command("XMC1|A_ValidPrivateToken123|ACTION|trim-up", token));
    assert(parse_command("XMC1|A_ValidPrivateToken123|THROTTLE|0.75", token));
    assert(!parse_command("XMC1|A_ValidPrivateToken123|THROTTLE|1.2", token));
    std::cout << "Protocol tests passed\n";
}
