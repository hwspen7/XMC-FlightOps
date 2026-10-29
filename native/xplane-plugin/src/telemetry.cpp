#include "xmc/telemetry.hpp"
#include <cmath>
#include <cctype>
#include <cstring>
#include <algorithm>
#include <cstdio>
#include <string>
namespace xmc {
void Telemetry::resolve() {
    for (auto& field : fields_) field.reference = XPLMFindDataRef(field.path);
    aircraft_icao_ = XPLMFindDataRef("sim/aircraft/view/acf_ICAO");
}
std::string Telemetry::packet(std::string_view token, bool armed) const {
    std::string result = "XMT1|" + std::string(token) + "|armed=" + (armed ? "1" : "0");
    for (const auto& field : fields_) {
        if (!field.reference) continue;
        const int types = XPLMGetDataRefTypes(field.reference);
        double value = 0;
        if (field.array_index >= 0) {
            if (types & xplmType_FloatArray) {
                float item = 0;
                if (XPLMGetDatavf(field.reference, &item, field.array_index, 1) != 1) continue;
                value = item;
            } else if (types & xplmType_IntArray) {
                int item = 0;
                if (XPLMGetDatavi(field.reference, &item, field.array_index, 1) != 1) continue;
                value = item;
            } else continue;
        } else if (types & xplmType_Double) value = XPLMGetDatad(field.reference);
        else if (types & xplmType_Float) value = XPLMGetDataf(field.reference);
        else if (types & xplmType_Int) value = XPLMGetDatai(field.reference);
        else continue;
        value *= field.scale;
        if (!std::isfinite(value)) continue;
        char number[48];
        std::snprintf(number, sizeof(number), "%.7g", value);
        result += "|";
        result += field.key;
        result += "=";
        result += number;
    }
    // The ICAO code is an aircraft property, not an inferred flap profile.
    // Only accept a small ASCII identifier, so no DataRef content can inject
    // protocol delimiters into the authenticated UDP telemetry packet.
    if (aircraft_icao_ && (XPLMGetDataRefTypes(aircraft_icao_) & xplmType_Data)) {
        char icao[41] = {};
        const int copied = XPLMGetDatab(aircraft_icao_, icao, 0, 40);
        if (copied > 0 && copied <= 40) {
            std::string code(icao, static_cast<std::size_t>(copied));
            code.resize(std::strlen(code.c_str()));
            const bool safe = code.size() >= 2 && code.size() <= 8 &&
                std::all_of(code.begin(), code.end(), [](unsigned char c) {
                    return std::isalnum(c) != 0 || c == '-';
                });
            if (safe) result += "|aircraftIcao=" + code;
        }
    }
    return result;
}
}  // namespace xmc
