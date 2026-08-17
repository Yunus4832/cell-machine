# Concept Design

[中文](concept.md) | [English](concept.en.md)

## Definition

A Cell is a continuous computing unit whose state is entirely local and strictly finite, whose code and data share one representation, whose behavior is directly described by a tiny instruction set, and whose ports form its external composition boundary.

```text
state:       finite unified memory
execution:   program pointer PP
operation:   data pointer DP
decision:    conditional control flow
interaction: input/output ports
continuity:  wrapping addresses and no terminal state
adaptation:  writable, generatable code
composition: ports connect environments and other Cells
```

## Relationship to Brainfuck

Brainfuck is the project’s primary intellectual source. Cell Machine retains PP and DP, the current cell as the implicit focus, the intuition of `><+-[],.`, rule-driven complexity, and a transparent instruction-as-language relationship.

It replaces the infinite tape with `2^A` unified `A+4`-bit words; gives every instruction an A-bit operand spanning the machine; resolves parameterless `[]()` at compile time; unifies code and data; treats I/O operands as port numbers; and adds absolute branches, pointer reflection, and data-driven PP changes. It is not Brainfuck-compatible—it advances Brainfuck’s minimalist philosophy from an abstract Turing machine toward a finite physical computing unit.

## Principles

### Finite

The Cell claims no infinite resources. Every immediate, address, and state can be fully represented.

### Continuous

There is no HALT, program end, or crash state. PP wraps naturally. An environment may stop supplying cycles, but that is outside Cell semantics.

### Fully defined

Every `A+4`-bit word executes safely. All 16 opcodes are defined, `>0` has no side effect, arithmetic and addresses wrap, and platforms define deterministic behavior for unconnected ports.

### Local

Data operations focus on `memory[DP]`, control operations on PP. There is no general register file, stack, exception machinery, or hidden global state.

### Unified and reflective

The same word is data or an instruction. `P` and `D` turn pointers into data; `@` interprets stored low A bits as a program entry. This closes the pointer → data → control-flow loop.

### Open and composable

Ports decouple the core from devices. The same program can connect to browser streams, GPIO, DACs, sensors, neighboring Cells, or game objects. More complex systems arise by copying Cells and changing topology rather than enlarging one core indefinitely.

## Not a miniature conventional CPU

Cell Machine prioritizes visible complete state, cheap replication, verifiable implementation, transparent programs, local communication, code mutation/migration, and matching virtual/physical semantics. Its fixed instructions are:

```text
> < + - =
[ ] ( ) : ;
P D @
, .
```

Exactly 16 behaviors fit a 4-bit opcode. Machine scale grows through A, not by expanding the ISA. The core intentionally omits a register file, hardware call stack, caches, virtual memory, exceptions, privilege levels, halt/break instructions, labels, functions, and types.

## Where complexity belongs

Hardware cost is copied into every Cell and paid each cycle; compiler cost is usually implemented once. Comments, diagnostics, `*`, and bracket filling therefore belong in tools. The boundary is simple: tools may express existing machine semantics reliably, but must not silently invent new runtime abstractions.

Parameterless `[]` fill relative targets; parameterless `()` fill absolute targets. Explicit forms remain independent machine instructions. `*` is only the target-width all-ones operand, so `:*` expresses the same fixed-point loop at every A.

## Finite determinism and “chaos”

An isolated deterministic finite Cell eventually reaches a fixed point or cycle, but its trajectory can still be long and hard to predict. External ports, random sources, and neighboring Cells rapidly enlarge the joint state space. `examples/collatz.cell` demonstrates irregular finite trajectories; `examples/dynamic.cell` demonstrates generated code and altered control flow.

## Composition vision

A Cell may be a programmable cellular-automaton site, a digital organism’s genome and brain, a game object VM, an FPGA control core, a signal/light/music node, or an element in a local message-passing array.

```text
few instructions × much time × many Cells × connection topology
```
