# SystemVerilog Reference Implementation

[中文](README.md) | [English](README.en.md)

[`rtl/cell_machine_core.sv`](rtl/cell_machine_core.sv) is the synthesizable SystemVerilog reference core for Cell Machine 0.0.1. Parameter `A` defaults to 8 (CM-4+8); the testbench uses `A=4` for a compact full-instruction test.

## Verification

```sh
cd hardware
make test
```

The test covers all 16 opcodes, relative and absolute branches, address wraparound, P/D pointer reflection, indirect execution, host loading, and port I/O. It writes `build/cell_machine.vcd`; use `make wave` to rerun the test and open the trace in GTKWave.

Reset clears PP and DP without clearing unified memory. A host write has priority over execution. While `enable` is high, one complete instruction transfers at each rising clock edge. I/O addresses and enables are presented before that edge. `debug_pp`, `debug_dp`, and `debug_word` expose the core execution state.

The behavioral memory is intended for clear simulation and specification validation. A target-specific synchronous RAM and multi-cycle FETCH/EXEC implementation can be added later without changing the architectural semantics.
