#include "xmc/telemetry.hpp"
#include <cmath>
#include <cstdio>
#include <string>
namespace xmc {
void Telemetry::resolve() {
    for (auto& field : fields_) field.reference = XPLMFindDataRef(field.path);
}
std::string Telemetry::packet(std::string_view token, bool armed) const {
    std::string result = "XMT1|" + std::string(token) + "|armed=" + (armed ? "1" : "0");
    for (const auto& field : fields_) {
        if (!field.reference) continue;
        const int types = XPLMGetDataRefTypes(field.reference);
        double value = 0;
        if (field.array_index >= 0) {
            if (!(types & xplmType_FloatArray)) continue;
            float item = 0;
            if (XPLMGetDatavf(field.reference, &item, field.array_index, 1) != 1) continue;
            value = item;
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
    return result;
}
}  // namespace xmc
