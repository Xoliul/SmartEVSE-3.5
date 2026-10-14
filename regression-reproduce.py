#!/usr/bin/env python3
"""Offline regressions against the actual SmartEVSE source functions.

Requires a host C++11 compiler. Decoder cases also need ArduinoJson 6 headers
(installed by `pio run -e release`). No device, network or flashed firmware.
"""
import argparse
import pathlib
import subprocess
import tempfile


def function(source, signature):
    start = source.index(signature)
    opening = source.index("{", start)
    depth = 1
    pos = opening + 1
    while depth:
        depth += (source[pos] == "{") - (source[pos] == "}")
        pos += 1
    return source[start:pos]


def prepare(root, bug, ref=None):
    src = root / "SmartEVSE-3" / "src"
    def read(name):
        if ref:
            return subprocess.check_output(["git", "show", f"{ref}:SmartEVSE-3/src/{name}"], cwd=root, text=True)
        return (src / name).read_text()
    main = read("main.cpp")
    esp = read("esp32.cpp")
    network = read("network_common.cpp")
    meter = read("meter.cpp")
    common = r'''
#include <algorithm>
#include <array>
#include <cstdint>
#include <cstdlib>
#include <cstdio>
#include <ctime>
#include <utility>
#define _LOG_A(...) do {} while (0)
#define _LOG_D(...) do {} while (0)
#define _LOG_I(...) do {} while (0)
#define _LOG_V(...) do {} while (0)
#define FAKE_SUNNY_DAY 0
#define EM_HOMEWIZARD 13
#define ALWAYS_OFF 1
#define COMM_TIMEOUT 11
#define CapacityPeriodSeconds 900
#define CapacityMinimumPower 2500
#define CapacitySafety 100
#define AssumedVoltage 230
enum CapacityMode_t { CAP_DISABLED, FIXED, INTERVAL, FLANDERS };
CapacityMode_t CapacityMode = FLANDERS;
bool LocalTimeSet = true;
uint8_t LoadBl = 0;
uint16_t MaxSumMains = 24;
int capacityCalls = 0;
struct Meter {
    uint8_t Type = EM_HOMEWIZARD, Address = 1;
    char DeviceHostName[32] = "fixture";
    int32_t NetCurrent = INT32_MIN;
    int16_t Irms[3] = {}, Imeasured = 0, PowerMeasured = 0;
    int32_t Import_active_energy = 100000, Export_active_energy = 0;
    int32_t CurrentPeriodStartEnergy = 0, Peak_Period_Power_Month = 0;
    void CalcImeasured();
    void setTimeout(uint8_t) {}
    void UpdateEnergies() {}
    void UpdateCapacity();
} MainsMeter;
struct CapacityNode { uint16_t start_minutes; int32_t max_power_watts; CapacityNode* next; };
CapacityNode* first_interval = nullptr;
std::time_t fakeNow = 1767225600; // 2026-01-01 00:00 UTC, quarter-hour boundary
std::time_t fakeTime(std::time_t* p) { if(p) *p=fakeNow; return fakeNow; }
std::tm* fakeLocaltime(const std::time_t* p, std::tm* out) { *out=*std::gmtime(p); return out; }
std::time_t phasesLastUpdate;
bool phasesLastUpdateFlag;
int16_t batteryCurrent = 0, Isum = 0, IrmsOriginal[3] = {};
int EnableC2 = ALWAYS_OFF;
int16_t getBatteryCurrent() { return batteryCurrent; }
'''
    common += "\n" + function(meter, "void Meter::CalcImeasured(void)")
    if bug in ("month", "overflow"):
        capacity = function(meter, "void Meter::UpdateCapacity()")
        common += "\n#define time fakeTime\n#define localtime_r fakeLocaltime\n" + capacity
        if bug == "month":
            common += r'''
int main() {
    MainsMeter.UpdateCapacity();
    fakeNow += 900;
    MainsMeter.Import_active_energy += 875; // 3500W average over a full quarter
    MainsMeter.UpdateCapacity();
    printf("peak=%d ", MainsMeter.Peak_Period_Power_Month);
    fakeNow = 1769904000; // 2026-02-01 00:00 UTC
    MainsMeter.UpdateCapacity();
    printf("new_month_peak=%d\n", MainsMeter.Peak_Period_Power_Month);
}
'''
        else:
            common += r'''
int main() {
    MainsMeter.UpdateCapacity();
    fakeNow += 870; // 30 seconds left in the same quarter
    MainsMeter.Import_active_energy += 265; // 360Wh left in the 625Wh budget
    MainsMeter.UpdateCapacity();
    printf("limit=%u\n", MaxSumMains);
}
'''
        return common
    common = "#include <ArduinoJson.h>\n" + common
    decoder = function(network, "std::pair<int8_t, std::array<std::int32_t, 6> > getDataFromHomeWizard")
    decoder = decoder[decoder.index("    uint8_t phases = 0;") :]
    # Clang rejects the original uint8_t -> int8_t braced conversion; cast
    # only the return expression in this host wrapper, with no value change.
    decoder = decoder.replace("return {phases,", "return {static_cast<int8_t>(phases),")
    common += r'''
std::pair<int8_t,std::array<int32_t,6>> decode(const JsonDocument& doc, int32_t* netCurrent = nullptr) {
    const char* currentKeys[]={"active_current_l1_a","active_current_l2_a","active_current_l3_a","active_current_a"};
    const char* powerKeys[]={"active_power_l1_w","active_power_l2_w","active_power_l3_w","active_power_w"};
    const char* totalsKeys[]={"total_power_import_kwh","total_power_export_kwh"};
''' + decoder
    common += r'''
DynamicJsonDocument fixture(4096);
std::pair<int8_t,std::array<int32_t,6>> getDataFromHomeWizard(const char*, int32_t* netCurrent=nullptr) {
    return decode(fixture,netCurrent);
}
'''
    if bug == "phase-count":
        common += r'''
void Meter::UpdateCapacity() {}
int main() {
    deserializeJson(fixture,R"({"active_current_l1_a":4.83,"active_current_l2_a":0,"active_current_l3_a":5.89,"active_current_a":10.72,"active_power_l1_w":0,"active_power_l2_w":0,"active_power_l3_w":0,"active_power_w":1661})");
    printf("aggregate_phases=%d ",decode(fixture).first);
    fixture.remove("active_current_a");
    printf("three_phases=%d ",decode(fixture).first);
    fixture.clear(); fixture["active_current_a"]=6;
    printf("single_phase=%d ",decode(fixture).first);
    fixture.clear(); printf("missing=%d\n",decode(fixture).first);
}
'''
        return common
    worker = function(esp, "static void homewizard_task(void *parameter)")
    mains = function(worker, "if (MainsMeter.Type == EM_HOMEWIZARD && LoadBl < 2)")
    common += "\n" + function(main, "void CalcIsum(void)")
    common += "\nvoid Meter::UpdateCapacity() { ++capacityCalls; }\nvoid pollMains() {\n" + mains + "\n}\n"
    if bug == "capacity-poll":
        common += r'''
int main() {
    fixture["active_current_a"]=6; fixture["active_power_w"]=1380;
    fixture["total_power_import_kwh"]=100; fixture["total_power_export_kwh"]=0;
    pollMains(); pollMains();
    printf("successful_updates=%d ",capacityCalls);
    fixture.clear(); pollMains();
    printf("after_failed_read=%d\n",capacityCalls);
}
'''
    else:
        common += r'''
int main() {
    // Only the three phase current keys: the separate fourth-phase defect
    // is intentionally not exercised by this solar reproduction.
    deserializeJson(fixture,R"({"active_current_l1_a":4.83,"active_current_l2_a":0,"active_current_l3_a":5.89,"active_power_l1_w":0,"active_power_l2_w":0,"active_power_l3_w":0,"active_power_w":-2300})");
    pollMains(); printf("export=%d max_phase=%d ",Isum,MainsMeter.Imeasured);
    fixture["active_power_w"]=2300; pollMains(); printf("import=%d ",Isum);
    batteryCurrent=30; pollMains(); printf("battery_adjusted=%d ",Isum);
    EnableC2=0; batteryCurrent=1; pollMains(); printf("battery_rounding=%d ",Isum);
    EnableC2=ALWAYS_OFF;
    batteryCurrent=0;
    fixture["active_power_l1_w"]=-1100; fixture["active_power_l3_w"]=1300;
    pollMains(); printf("mixed_phases=%d\n",Isum);
    fixture.clear(); fixture["active_current_a"]=6.5; fixture["active_power_w"]=-1495;
    MainsMeter=Meter{}; // independent single-phase device, with empty other channels
    pollMains(); printf("single_phase_export=%d ",Isum);
    MainsMeter.Type=9; MainsMeter.Irms[0]=50; MainsMeter.Irms[1]=-20; MainsMeter.Irms[2]=30;
    CalcIsum(); printf("other_meter=%d\n",Isum);
}
'''
    return common


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bug", choices=["phase-count", "solar", "capacity-poll", "month", "overflow"])
    parser.add_argument("--root", type=pathlib.Path, default=pathlib.Path.cwd())
    parser.add_argument("--expect-bug", action="store_true")
    parser.add_argument("--ref", help="Read production functions from this Git revision instead of the working tree")
    parser.add_argument("--cxx", nargs="+", default=["c++"])
    args = parser.parse_args()
    headers = args.root / "SmartEVSE-3/.pio/libdeps/release/ArduinoJson/src"
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp)
        source = path / "repro.cc"
        source.write_text(prepare(args.root, args.bug, args.ref))
        exe = path / "repro.exe"
        subprocess.run(args.cxx + ["-std=c++11", "-I", str(headers), str(source), "-o", str(exe)], check=True)
        result = subprocess.check_output([str(exe)], text=True).strip()
    actual = dict(part.split("=") for part in result.split())
    expected = {
        "phase-count": dict(aggregate_phases="4" if args.expect_bug else "3", three_phases="3", single_phase="1", missing="0"),
        "solar": {"export": "106" if args.expect_bug else "-100", "max_phase": "58", "import": "106" if args.expect_bug else "100", "battery_adjusted": "76" if args.expect_bug else "70", "battery_rounding": "106" if args.expect_bug else "100", "mixed_phases": "10", "single_phase_export": "-65", "other_meter": "60"},
        "capacity-poll": dict(successful_updates="0" if args.expect_bug else "2", after_failed_read="0" if args.expect_bug else "2"),
        "month": dict(peak="2500" if args.expect_bug else "3500", new_month_peak="2500"),
        "overflow": dict(limit="1" if args.expect_bug else "187"),
    }[args.bug]
    print(result)
    if actual != expected:
        raise SystemExit(f"FAIL: expected {expected}, got {actual}")
    print("Confirmed upstream defect" if args.expect_bug else "Regression checks passed")


if __name__ == "__main__":
    main()
