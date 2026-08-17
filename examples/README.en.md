# Examples

[中文](README.md) | [English](README.en.md)

Paste any `.cell` file into the source area of `web/index.html`.

| File | Purpose |
| --- | --- |
| `hello.cell` | Prints `Hello, Cell!`, then enters a stable spin |
| `yes-forever.cell` | Prints `yes` forever |
| `interactive.cell` | Reads the character port and answers `yes` or `no` |
| `running-light.cell` | Produces a bouncing bitmap on numeric ports |
| `collatz.cell` | Implements an irregular Collatz trajectory with core instructions |
| `dynamic.cell` | Generates `;10`, saves an entry pointer, and executes through `@` |
| `call-return.cell` | Saves a return address with `P` and calls/returns through `@` |
| `bracket-sugar.cell` | Demonstrates relative `[]`, absolute `()`, and portable `:*` filling |

The browser platform maps port zero to a character stream and displays other ports as `A+4`-bit numeric events.

Root examples target `A=8`; they can be recompiled for larger variants when operands, capacity, and address layout permit. The browser generates compact programs for `A=4–6`, and uses the full set with data placed at the address-space midpoint for `A=7, 8, 10, 12`.

The dynamic-code example uses `+*` to construct a target-width word instead of embedding an `A=8` encoding. [`4+4/`](4+4/) contains tiny programs for a physical 16-word prototype.
