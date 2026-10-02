# SmartEVSE C++ Safety Rules (JSF-inspired, distilled)

## What this is

This is a **practical subset inspired by the Joint Strike Fighter Air Vehicle C++ Coding Standards (JSF AV C++)**, rewritten for an embedded project like **SmartEVSE**. The original JSF AV standard is a **141-page Lockheed Martin document from December 2005** for safety-critical C++ development. It defines rule categories (`shall`, `will`, `should`) and focuses on a safer subset of C/C++ for reliable, testable, maintainable systems. For modern C++11/14 and newer, **JSF is historically important but dated**; AUTOSAR C++14 was later created specifically because older standards such as JSF/MISRA C++ did not fully cover newer C++ versions. citeturn1view0turn2view2turn3view0

So this document is **not “JSF compliance”**, but a **SmartEVSE-oriented house standard** that tries to capture the same safety mindset.

---

## Core principle

For SmartEVSE, code should be:

- **Predictable**
- **Fail-safe**
- **Explicit**
- **Statically analyzable**
- **Easy to review**
- **Difficult to misuse**

When there is a tradeoff between cleverness and predictability, **pick predictability**.

---

## The short version: rules worth enforcing

## 1. Keep control logic simple

- Functions should be **small and single-purpose**.
- Avoid deep nesting.
- Prefer early validation and simple branches over complicated stateful logic.
- A function should ideally do **one thing**: read inputs, validate, compute, command outputs, or log.

**For SmartEVSE:**
- Separate `readMeters()`, `computeAllowedCurrent()`, `applyChargingLimit()`, `checkSafetyInterlocks()`, `publishStatus()`.
- Do not mix Modbus I/O, business logic, UI formatting, and fail-safe behavior in one function.

---

## 2. No hidden behavior

- Avoid surprising side effects.
- Do not hide important work in overloaded operators, macros, or constructors.
- State transitions must be explicit.

**For SmartEVSE:**
- It should be obvious where charging is enabled, paused, derated, or faulted.
- Any code that can energize contactors or raise current must be easy to grep and review.

---

## 3. Initialize everything, as late as practical

The JSF standard requires variables to be initialized before use and recommends declaring them at the smallest feasible scope. citeturn2view1

Use this in practice:

- Initialize every variable.
- Declare variables **close to first use**.
- Do not create “empty for now, fill later” variables unless unavoidable.
- Prefer constructor initialization lists for class members.

**Good:**
```cpp
const int32_t available_mA = read_available_current_mA();
```

**Avoid:**
```cpp
int32_t available_mA;
// lots of code
available_mA = read_available_current_mA();
```

---

## 4. Ban dynamic memory in runtime control paths

- No `new`, `delete`, `malloc`, dynamic allocation, or hidden allocator use in time-critical or safety-critical paths.
- No allocation after startup for the charging control loop.
- Avoid containers that may reallocate unpredictably unless bounded and initialized at startup.

**For SmartEVSE:**
- The main loop, protection logic, phase balancing, and watchdog recovery must use fixed-size storage only.
- Any dynamic allocation should be limited to startup, test tools, or non-critical UI/web layers.

---

## 5. Fixed-width types only

JSF explicitly recommends avoiding plain `int`, `short`, `long`, `float`, and `double` in favor of specific-length typedefs because sizes vary across compilers and targets. citeturn1view0

Use:

- `std::uint8_t`, `std::uint16_t`, `std::uint32_t`
- `std::int16_t`, `std::int32_t`
- `bool`

Avoid in control code:

- raw `int`
- raw `long`
- target-dependent assumptions

**For SmartEVSE:**
- Currents, voltages, timer ticks, error flags, register values, phase masks: all fixed-width.
- Put units in names: `current_mA`, `voltage_dV`, `timeout_ms`.

---

## 6. Prefer integers over floats for control decisions

JSF requires IEEE-754 if floating point is used, and warns against unsafe floating-point assumptions and conversions. citeturn2view1

For embedded EV charging logic:

- Use integer math for thresholds, limits, debounce timers, power windows, and current calculations where possible.
- Represent values in scaled integers such as mA, dV, W, or 0.1 A.
- Convert to float only for display or non-critical analytics.

**Reason:** integer logic is easier to reason about and less prone to rounding surprises at safety boundaries.

---

## 7. Avoid casts; when needed, make them explicit and rare

JSF requires C++-style casts instead of C-style casts because intent is clearer and review is safer. citeturn2view1

House rule:

- No C-style casts.
- Minimize all casts.
- `reinterpret_cast` is effectively banned except in tightly reviewed hardware abstraction code.
- Any cast across signedness, width, or protocol boundary should be isolated and commented.

---

## 8. No macros for logic

- Use `constexpr`, `enum class`, inline functions, and templates instead of macros.
- Macros are allowed only for guarded compile-time configuration, include guards, or platform/compiler workarounds.

**For SmartEVSE:**
- No macro-based min/max, state logic, unit conversions, logging side effects, or register manipulation helpers.

---

## 9. Use enums and named states, never magic numbers

- Model charger state explicitly.
- Use `enum class` for states, modes, faults, relay state, cable state, and phase topology.
- Replace “6 means waiting-for-solar” with named constants.

**Example:**
```cpp
enum class ChargeState : std::uint8_t {
    Idle,
    WaitingForVehicle,
    Ready,
    Charging,
    Derated,
    Fault
};
```

---

## 10. No `goto`, no clever loop exits, no ambiguous flow

JSF forbids `goto`, forbids `continue`, restricts `break`, and requires unreachable code to be absent. citeturn2view1

For SmartEVSE:

- No `goto`.
- Avoid `continue`.
- Use `break` only when the exit is obvious.
- Every loop must have a clear bounded purpose.
- Every `switch` should be exhaustive or have a defensive `default`.

---

## 11. Every `if` and `switch` must be boringly clear

- Always use braces.
- Do not rely on fallthrough.
- Make default handling explicit.
- Do not use `switch` on booleans.

JSF requires braces for initialization structure and contains several rules around `switch` completeness, `break`, and explicit defaults. citeturn2view1

**For SmartEVSE:**
- State machine code should be obvious to a tired reviewer at 2 a.m.

---

## 12. One source of truth for safety decisions

- Compute the allowed current in one place.
- Merge all derating constraints into a single reviewed path.
- Never let UI, MQTT, Modbus, solar logic, and thermal protection independently override current in scattered code.

**Recommended pattern:**
1. Read raw inputs
2. Validate freshness/plausibility
3. Derive constraints
4. Take the most conservative result
5. Apply output
6. Log why

---

## 13. Every external input must be validated

Treat all incoming data as untrusted:

- meter values
- Modbus registers
- CT readings
- contactor feedback
- temperature sensors
- vehicle status
- config from flash/web/UI
- network commands

For each input, define:

- valid range
- timeout / freshness limit
- fallback behavior
- fault behavior

**For SmartEVSE:**
- A stale solar reading must not keep charging alive.
- A missing phase-current reading should force a conservative fallback.
- A contradictory relay/contactor feedback should trip to fault.

---

## 14. Fail safe, not fail operational

If data is missing or contradictory:

- reduce current,
- pause charging, or
- enter a fault state,

rather than “best guessing” at full power.

**Default philosophy:**
- Missing optional telemetry → degrade gracefully.
- Missing safety-critical telemetry → stop or derate.

---

## 15. Time must be explicit

- No hidden time assumptions.
- No logic that depends on loop speed “usually being fast enough.”
- All delays, retries, stale-data windows, debounce times, watchdog periods, and relay settle times must be explicit constants.

**For SmartEVSE:**
- Use monotonic tick-based timing.
- Compare against `now_ms` / `elapsed_ms`, not iteration counts.

---

## 16. Separate hardware abstraction from policy

- Hardware drivers should read/write pins, UART, ADC, Modbus, PWM, relays.
- Policy code should decide **what should happen**, not **how registers are poked**.

**Why:** this makes code testable and prevents hardware quirks from leaking into safety logic.

---

## 17. No exceptions in embedded control code

JSF predates modern exception discussions, but its philosophy strongly favors predictability and analyzability. AUTOSAR later relaxed some older blanket restrictions, but only within a more formal rule system. citeturn1view0turn3view0

For SmartEVSE, I would keep the rule simple:

- **No C++ exceptions** in firmware/control paths.
- Use explicit return values, status enums, or expected/result types.
- Initialization can report failure explicitly and fail closed.

---

## 18. Limit inheritance; prefer composition

JSF adds many rules around safe use of C++ class features, inheritance, interfaces, and abstract classes. It explicitly prefers hierarchies based on abstract classes and gives constraints on interface design. citeturn1view0

For SmartEVSE:

- Prefer composition over inheritance.
- Use inheritance only for clear interfaces such as `IMeter`, `IContactorDriver`, `ILogger`.
- Avoid deep class hierarchies.
- No data-bearing base class shared casually across the system.

---

## 19. One module, one responsibility, one owner

Each module should have a sharply defined role, such as:

- metering
- safety checks
- charging state machine
- current budget calculation
- hardware outputs
- persistence/config
- comms
- diagnostics

Do not let “utility” modules become hidden dependency hubs.

---

## 20. Logging must explain safety decisions

Logs should answer:

- Why did charging stop?
- Why was current reduced?
- Which sensor went stale?
- Which limit won: grid, thermal, cable, phase imbalance, user cap, or solar?

**A good safety log message includes:**
- decision
- cause
- measured value
- threshold
- timestamp or cycle id

---

## 21. Make invalid states hard to represent

- Use strong types and enums.
- Validate configuration at load time.
- Clamp or reject impossible values immediately.

Examples:

- max current cannot exceed hardware rating
- min charge current cannot exceed max current
- 1-phase/3-phase mode must match wiring capability
- contactor-on while PWM says disabled should be impossible or faulted immediately

---

## 22. Test the bad paths first

A JSF-style mindset is not just about syntax restrictions; it is about making failures visible and reviewable. The standard itself distinguishes between mandatory/advisory rule levels and formal handling of deviations. citeturn2view2turn3view0

For SmartEVSE, test these before happy-path tuning:

- stale meter data
- negative or impossible sensor readings
- phase loss
- contactor weld / feedback mismatch
- boot during active charge request
- EEPROM/flash config corruption
- watchdog reset mid-session
- communication timeout with external meter
- solar suddenly disappearing
- current limit oscillation around thresholds

---

## 23. Deviations must be written down

If you break a rule, document:

- which rule
- why
- what safer alternatives were rejected
- what mitigation exists
- how it is tested

This is straight in the spirit of JSF/AUTOSAR-style compliance culture. citeturn2view2turn3view0

---

## A compact SmartEVSE house standard

If you want the shortest enforceable version, I would adopt this:

1. No runtime dynamic allocation in control/safety code.
2. No exceptions in firmware control paths.
3. No C-style casts; minimize all casts.
4. Fixed-width integer types only in embedded logic.
5. Integer math for thresholds and control decisions.
6. All variables initialized before use.
7. Small functions, single responsibility.
8. Explicit state machines with `enum class`.
9. All external inputs range-checked and freshness-checked.
10. Missing critical data must derate or stop charging.
11. One reviewed function computes the final allowed current.
12. No `goto`; avoid `continue`; keep loop exits obvious.
13. Always use braces.
14. No magic numbers; name constants and units.
15. Separate hardware I/O from decision logic.
16. Every safety decision must be loggable and testable.
17. Every deviation must be documented.

---

## What I would add specifically for an EV charger

Beyond classic JSF-style rules, SmartEVSE should also enforce these domain rules:

- **Last valid data timestamp on every sensor/input**
- **Plausibility checks** between related signals
- **Rate limiting** on current changes to avoid relay/vehicle thrash
- **Hysteresis** around solar surplus thresholds
- **Monotonic safety escalation**: warning → derate → stop → fault
- **Safe startup defaults**: outputs de-energized until checks pass
- **Single writer principle** for contactor and PWM commands
- **Watchdog-backed recovery** with explicit boot reason logging

---

## Important reality check

If your firmware is modern C++14/C++17 rather than older C++03-era embedded C++, then **using JSF as inspiration makes sense, but using AUTOSAR C++14 or MISRA C++ as the formal reference is usually a better fit** because they were created to address gaps in older standards for newer C++ language versions. citeturn3view0

So my recommendation would be:

- **Use this distilled JSF-style checklist as your practical coding policy now**
- Then, if you want stricter formalization, align the implementation and reviews with **AUTOSAR C++14-style rules**

---

## Suggested header for your repo

```md
This firmware follows a safety-oriented embedded C++ subset inspired by JSF AV C++.
Primary goals are predictability, explicit behavior, fail-safe defaults, bounded resource use,
and easy review of all code that can influence charging current, relay state, or safety behavior.
```
