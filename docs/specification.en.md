# Cell Machine 0.0.1 Specification

[中文](specification.md) | [English](specification.en.md)

This document defines the parameterized architecture, compact encoding, and source format. Numbers are hexadecimal unless stated otherwise.

## 1. Architecture parameters

Each machine is defined by address width `A`:

```text
opcode width        O = 4
operand width       A
PP / DP width       A
address count       N = 2^A
word / Cell width   W = A + 4
```

| Model | A | W | Unified memory |
| --- | ---: | ---: | ---: |
| `CM-4+4` | 4 | 8 | 16 × 8 bits |
| `CM-4+5` | 5 | 9 | 32 × 9 bits |
| `CM-4+6` | 6 | 10 | 64 × 10 bits |
| `CM-4+7` | 7 | 11 | 128 × 11 bits |
| `CM-4+8` | 8 | 12 | 256 × 12 bits |
| `CM-4+10` | 10 | 14 | 1024 × 14 bits |
| `CM-4+12` | 12 | 16 | 4096 × 16 bits |

Implementations may support any positive A. The browser supports `4, 5, 6, 7, 8, 10, 12`. One operand always spans the complete address space.

## 2. Machine state

```text
memory[N]    N unified W-bit words
PP           A-bit program pointer
DP           A-bit data pointer
```

The core exposes an A-bit port address and W-bit data interface. Devices, queues, registers, and their state belong to the platform, not the core architecture. Reset sets PP and DP to zero. Program loading, initial memory, and execution cycles are platform responsibilities.

## 3. Word encoding

```text
W-1        A A-1                  0
+------------+---------------------+
| opcode: 4  | operand: A          |
+------------+---------------------+
```

| Opcode | Symbol | Opcode | Symbol |
| ---: | :---: | ---: | :---: |
| `0` | `>` | `8` | `)` |
| `1` | `<` | `9` | `:` |
| `2` | `+` | `A` | `;` |
| `3` | `-` | `B` | `P` |
| `4` | `=` | `C` | `D` |
| `5` | `[` | `D` | `@` |
| `6` | `]` | `E` | `,` |
| `7` | `(` | `F` | `.` |

All opcodes are defined. The zero word is `>0`, a natural NOP. There is no ASCII machine encoding. In CM-4+8, `>80 = 0x080` and `;10 = 0xA10`; in CM-4+12 the same values are `>080 = 0x0080` and `;010 = 0xA010`.

## 4. Fetch semantics

```text
instruction <- memory[PP]
PP <- PP + 1 mod N
execute instruction
```

Control-flow operands use the already incremented PP.

## 5. Data and pointer instructions

| Instruction | Semantics |
| --- | --- |
| `>n` | `DP <- DP + n mod N` |
| `<n` | `DP <- DP - n mod N` |
| `+n` | `memory[DP] <- memory[DP] + zero_extend_W(n) mod 2^W` |
| `-n` | `memory[DP] <- memory[DP] - zero_extend_W(n) mod 2^W` |
| `=n` | `memory[DP] <- zero_extend_W(n)` |

Omitted operands default to one for `> < + -`, and zero for `=`.

## 6. Relative control flow

| Instruction | Semantics |
| --- | --- |
| `[n` | if `memory[DP] == 0`, `PP <- PP + n mod N` |
| `]n` | if `memory[DP] != 0`, `PP <- PP + n mod N` |
| `:n` | `PP <- PP + n mod N` |

For paired parameterless brackets at addresses L and R:

```text
memory[L].operand = R - L mod N
memory[R].operand = L - R mod N
```

Pairing is compile-time only. `:*` is a portable fixed-point loop: `*` expands to the A-bit all-ones value `N-1` (for A=4/5/8/12: `F`, `1F`, `FF`, `FFF`). `*` is a general operand constant, not an instruction.

## 7. Absolute control flow

| Instruction | Semantics |
| --- | --- |
| `(n` | if `memory[DP] == 0`, `PP <- n` |
| `)n` | if `memory[DP] != 0`, `PP <- n` |
| `;n` | `PP <- n` |

For paired parameterless parentheses at L and R:

```text
memory[L].operand = R + 1 mod N
memory[R].operand = L + 1 mod N
```

Explicit `[]()` instructions are independent branches and do not pair. Parameterless forms must nest correctly by type and cannot be closed by explicit forms.

## 8. Pointer reflection and indirect execution

All three use `address = DP + n mod N`:

| Instruction | Semantics |
| --- | --- |
| `Pn` | `memory[address] <- zero_extend_W(PP)` |
| `Dn` | `memory[address] <- zero_extend_W(DP)` |
| `@n` | `PP <- low_A(memory[address])` |

Their default operand is zero. `P` observes PP after fetch increment, so it saves the next instruction address. `P` and `D` clear the upper four bits; `@` reads only the low A bits.

## 9. I/O

| Instruction | Semantics |
| --- | --- |
| `,n` | `memory[DP] <- input(port[n])` |
| `.n` | `output(port[n], memory[DP])` |

The port number is A bits and port data is W bits. Protocols, blocking behavior, and physical connections are platform-defined. The browser maps port zero to character I/O (empty input returns zero), other ports to W-bit register-like values, and uses the low eight bits for character output.

## 10. Continuity

There is no HALT, BREAK, program end, address fault, or illegal opcode. PP, DP, addresses, and arithmetic wrap at their widths. A host may pause, step, reset, or edit state, but these are not Cell instructions.

## 11. Source format

Valid instruction symbols are:

```text
> < + - = [ ] ( ) : ; P D @ , .
```

An operand contains one to `ceil(A/4)` hexadecimal digits, directly after the opcode or separated by spaces/tabs. Omitted high bits are zero. `*` replaces a numeric operand with the A-bit all-ones value. `0x80` is also accepted.

Hexadecimal operands use longest matching, so a following `D` may be consumed as a hex digit; insert whitespace before a `D` instruction. Values outside A bits are errors (for A=5, the maximum is `1F`). A `#` starts a comment through end of line. Other non-instruction characters are ignored, but prose should remain in comments so instruction symbols cannot be mistaken for code.

## 12. Compiler responsibilities

The compiler maps symbols to opcodes, parses A-bit operands, expands `*`, supplies defaults, fills parameterless `[]()`, validates brackets and operands, and enforces at most N words. It provides no labels, variables, macros, functions, types, linker, or hidden multi-instruction expansion. Compilation errors are tool state, not runtime state.

## 13. Portability

Larger A expands code, data, and port space together. Source is portable when its explicit values fit, compiled length is at most `2^A`, it does not depend on width-specific wrapping, and the platform supplies its ports. Prefer `*` over hard-coded `F`, `FF`, or `FFF`. Binary words of different widths are not required to be compatible; source and the 16 instruction semantics are the stable family boundary.

## 14. Implementation freedom

The specification defines observable state changes, not cycle counts or physical storage. Implementations may use wider RAM macros, multi-cycle single-port RAM, dual-port RAM, DP caching, fixed-point clock gating, or time-share one execution unit among logical Cells, provided architectural results do not change.
