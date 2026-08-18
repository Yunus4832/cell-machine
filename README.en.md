# Cell Machine

[中文](README.md) | [English](README.en.md)

**Cell Machine** is a finite, continuous, composable minimal computing unit. It is not a shrunken general-purpose computer, but a reusable “computing cell” from which larger systems can be built.

It is directly inspired by [Brainfuck](https://en.wikipedia.org/wiki/Brainfuck): it retains a program pointer, a data pointer, current-cell operations, and a tiny symbolic instruction set, while deliberately replacing the infinite tape with a closed finite machine suitable for physical implementation.

> Brainfuck shows that a few rules are enough to express computation; Cell Machine explores how a few physical states can compose a computing system.

The current release is the **0.0.1 parameterized proof-of-concept specification**.

## In one minute

A Cell Machine has only:

- `2^A` words of unified memory;
- A-bit program pointer `PP` and data pointer `DP`;
- `2^A` addressable logical I/O port numbers;
- a fixed 4-bit opcode encoding exactly 16 core instructions;
- an A-bit operand and an `A+4`-bit machine word.

Reset sets `PP = 0` and `DP = 0`. A program normally moves DP out of its code area first; for `A=8`:

```cell
>80
```

PP and DP address the same memory, and pointers can become ordinary data:

```cell
P       # memory[DP] <- PP
D01     # memory[DP+1] <- DP
@       # PP <- low_A(memory[DP])
```

There is no halt instruction or program end. Addresses wrap modulo `2^A`; every opcode is defined; and the zero word `>0` is naturally a NOP. A program may reach a fixed point, but architectural fetch and execution continue while the environment supplies cycles.

## Finite means simpler

```text
opcode width       = 4 bits
operand/address    = A bits
PP / DP            = A bits
address count      = 2^A
memory/instruction = A+4 bits
logical ports      = 2^A
```

One operand spans the whole address space. There are no long jumps, address extensions, alignment faults, runtime bracket scans, or loop stacks. Complete machine state is easy to inspect, copy, migrate, and reproduce, and every `A+4`-bit word has deterministic behavior.

The same semantics form a processor family:

```text
CM-4+4   = 16 x 8-bit cells
CM-4+5   = 32 x 9-bit cells
CM-4+6   = 64 x 10-bit cells
CM-4+7   = 128 x 11-bit cells
CM-4+8   = 256 x 12-bit cells
CM-4+10  = 1024 x 14-bit cells
CM-4+12  = 4096 x 16-bit cells
```

Increasing A expands code, data, and port space without adding instructions or architectural state.

## Instruction overview

| Class | Instructions | Meaning |
| --- | --- | --- |
| Data pointer | `>n` `<n` | Move DP right or left relatively |
| Data | `+n` `-n` `=n` | Add, subtract, or assign the current word |
| Relative control | `[n` `]n` `:n` | JZ, JNZ, JMP |
| Absolute control | `(n` `)n` `;n` | JZ, JNZ, JMP |
| Pointer reflection | `Pn` `Dn` | Write PP or DP to `memory[DP+n]` |
| Indirect control | `@n` | `PP <- low_A(memory[DP+n])` |
| I/O | `,n` `.n` | Read from or write to a port |
| Source | `#` | Comment to end of line; emits no word |

Parameterless `[]` pairs are filled with relative offsets by the compiler; parameterless `()` pairs receive absolute addresses. Explicit `[n ]n (n )n` are independent conditional branches. `*` expands to the all-ones A-bit operand, making `:*` a portable fixed-point spin loop. Pairing exists only in the compiler—hardware never scans brackets or maintains a loop stack.

See the [complete specification](docs/specification.en.md).

## Run it now

Open `web/index.html` directly in a browser. The reference environment provides compile, reset, run, host pause, and single-step controls; parameterized paged memory; selectable power-of-two rates from 1 to 4096 IPS; PP, DP, and current-word inspection; character and numeric ports; direct word editing; bracket filling; and diagnostics.

Supported A values are `4, 5, 6, 7, 8, 10, 12`. Host pause is not a Cell instruction or architectural state.

## A continuous program

For `A=8`:

```cell
# output "yes" forever
>80
=79 .00
=65 .00
=73 .00
=0A .00
;01
```

## Code is data

This `A=8` fragment constructs the word `A10` (`;10`) in blank data memory, saves the dynamic entry address `80`, and executes it indirectly:

```cell
>80 =00
+* +* +* +* +* +* +* +* +* +* +1A
D01 @01
```

See [examples/dynamic.cell](examples/dynamic.cell) for the full program.

## Design goals

1. **Simple and readable:** one short specification explains the core.
2. **Hardware-friendly:** narrow pointers, fixed words, little state, no exceptions or runtime bracket scans.
3. **Transparent execution:** source operations map directly to machine words.
4. **Continuous existence:** no halt, end, or illegal execution state.
5. **Fully defined:** all opcodes, words, addresses, and arithmetic have deterministic behavior.
6. **Open interaction:** ports connect streams, GPIO, sensors, neighboring Cells, or game worlds.
7. **Code/data identity:** programs can inspect, modify, generate, and execute programs.
8. **Composable:** complexity comes from replication, connection, and evolution over time.

## Applications

- Tiny FPGA/ASIC control cores and programmable state machines;
- deterministic signal, lighting, music, and interactive installations;
- programmable game objects, robots, factories, and digital organisms;
- cellular automata, artificial life, and self-modifying-code experiments;
- large locally communicating Cell arrays;
- teaching computer architecture and language design.

It is not intended to replace large MCUs, operating systems, or high-performance numeric processors.

## Multiple Cells

Each Cell keeps local state and communicates through ports—shared memory and cache coherence are unnecessary. Arrays may be grids, rings, trees, pipelines, or game-defined topologies. I/O is the composition boundary between a core, peripherals, neighbors, and management environments.

## Compiler boundary

The compiler handles whitespace and comments, default operands, `*`, relative `[]` filling, absolute `()` filling, operand ranges, bracket structure, and the `2^A`-word program limit. It deliberately omits labels, variables, macros, functions, types, and linking. Tools may help people express existing machine semantics accurately, but should not silently invent a higher-level language.

## Repository

```text
cell-machine/
├── README.md / README.en.md
├── docs/          # concept, specification, and hardware notes (zh/en)
├── examples/      # runnable .cell programs and bilingual index
├── hardware/
│   ├── logisim/cell-machine-4+8.circ
│   ├── rtl/cell_machine_core.sv
│   └── tb/tb_cell_machine_core.sv
└── web/           # browser compiler, executor, and interface
```

## Lineage and status

Cell Machine explicitly acknowledges Brainfuck’s two-pointer minimalism, [Self-modifying Brainfuck](https://soulsphere.org/hacks/smbf/), Core War, Tierra, Avida, GreenArrays GA144, processor arrays, and programmable state machines. Its goal is to converge these ideas into a finite, symmetric computing cell reusable in software and hardware.

Version 0.0.1 fixes the 16 core instructions and the parameterized `4+A` word, and validates unified memory, pointer reflection, indirect control flow, and variable address widths through the browser implementation, examples, a Logisim prototype, and SystemVerilog RTL with a complete opcode self-test. It remains an evolving architecture proposal; future work includes target-specific FPGA memory and timing, Cell-array interconnects, and a standalone compiler.
