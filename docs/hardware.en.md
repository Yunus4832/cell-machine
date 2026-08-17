# Hardware Implementation Notes

[中文](hardware.md) | [English](hardware.en.md)

[`hardware/logisim/cell-machine-4+8.circ`](../hardware/logisim/cell-machine-4+8.circ) is a Logisim 2.7.1 example of **CM-4+8**: 4-bit opcode, 8-bit operand, 12-bit word, and 256 memory words. It is not one fixed circuit for every A. Other variants keep the same ISA and datapath shape while resizing PP, DP, RAM, words, and arithmetic components.

## Minimal datapath

```text
                  +--------------------+
          PP ---->|                    |
                  | 2^A x (A+4) memory |
          DP ---->|                    |
                  +----------+---------+
                             | instruction / data
                      +------v------+
                      | decoder/ALU |
                      +------+------+ 
                             |
                      +------v------+
                      |  port bus   |
                      +-------------+
```

Architectural state is A-bit PP, A-bit DP, unified memory, plus implementation control state. A-bit address truncation implements wrapping without bounds checks. All 16 opcodes are defined and the zero word `>0` has no effect.

## Single-port RAM

The smallest prototype time-multiplexes instruction and data access:

```text
FETCH:    memory[PP] -> instruction; increment PP
EXECUTE:  access memory[DP] or a port according to opcode
```

Pointer-only instructions may avoid a data cycle. `P` and `D` perform a DP-relative write; `@` performs a DP-relative read. A combinational-read prototype can use a uniform two-phase controller. Synchronous RAM may add wait/writeback phases; the architecture does not require equal instruction latency.

## Pointer reflection

`P`, `D`, and `@` share `effective_address = DP + operand`. P writes zero-extended PP, D writes zero-extended DP, and `@` loads PP from the low A bits of memory at that address. No architectural register, stack, or exception is added; the existing adder, memory port, and PP writeback path are reused.

## Dual-port RAM and current-word caching

A dual-port implementation dedicates one port to PP fetch and another to DP access, improving throughput at the cost of RAM resources, bypassing, and explicit same-address behavior.

An implementation may cache `memory[DP]`: consecutive data, I/O, and conditional operations use the cache; moving DP writes back and reloads; PP fetch needs bypassing when it addresses the cached word. This reduces single-port pressure but is unnecessary for a minimal core.

## I/O bus

```text
port_address[A-1:0]
write_data[A+3:0]
read_data[A+3:0]
read_enable
write_enable
```

Logical port numbers do not require `2^A` physical registers. A platform may decode only the ports it needs and map them to GPIO, UART FIFOs, PWM/timers, DAC/ADC, neighboring-cell mailboxes, random data, time, or game state. Fixed-cycle nonblocking ports suit precise timing; slow peripherals should retain protocol state outside the core.

## No halt state

The Cell continues fetching. `:*` compiles to `:(N-1)`, an ordinary relative fixed-point loop. Hardware may gate a known fixed state, but external reset, state writes, or platform events must be able to resume cycles. Debug enable may hold state externally; it does not require HALT, BREAK, or PAUSED opcodes.

## Browser IPS and hardware clock

The browser reports completed instructions per second, not clock frequency. The current Logisim prototype uses FETCH and EXEC phases, so without waits:

```text
hardware clock frequency = 2 x instruction rate
```

Thus 4096 IPS corresponds ideally to about 8192 Hz. Browser scheduling, memory rendering, and I/O logging make measured IPS non-real-time.

## Cell arrays

The natural extension gives every Cell local memory and exchanges messages through ports. Grids, rings, trees, pipelines, synchronous meshes, GALS networks, shared tile executors, and time-multiplexed logical Cells are all possible. Avoiding global shared memory avoids coherence, locking, and large crossbars. Program loading, reset, host pause, snapshots, and routing belong to a management platform, but an individual Cell does not depend on it to execute continuously.

## Area intuition

Local storage is `2^A × (A+4)` bits:

| A | Words | W | Total bits |
| ---: | ---: | ---: | ---: |
| 4 | 16 | 8 | 128 |
| 5 | 32 | 9 | 288 |
| 6 | 64 | 10 | 640 |
| 7 | 128 | 11 | 1408 |
| 8 | 256 | 12 | 3072 |
| 10 | 1024 | 14 | 14336 |
| 12 | 4096 | 16 | 65536 |

CM-4+5 uses only about 9.4% of CM-4+8’s complete storage and is attractive for Logisim or sandbox-game prototypes. FPGA RAM macros can hold nonstandard logical widths in wider physical words. In large arrays, SRAM and interconnect will often dominate PP, DP, ALU, and the 4-to-16 decoder.
