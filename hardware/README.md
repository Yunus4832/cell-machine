# SystemVerilog 参考实现

[中文](README.md) | [English](README.en.md)

[`rtl/cell_machine_core.sv`](rtl/cell_machine_core.sv) 是 Cell Machine 0.0.1 的可综合 SystemVerilog 参考核心。参数 `A` 默认为 8，即 CM-4+8；测试平台使用 `A=4` 加速完整指令验证。

## 验证

运行自检测试：

```sh
cd hardware
make test
```

测试覆盖全部 16 个 opcode、相对和绝对跳转、地址环绕、P/D 指针反射、间接执行、程序装载以及端口读写。成功时输出：

```text
PASS: all 16 Cell Machine opcodes and interfaces verified
```

测试会生成 `build/cell_machine.vcd`。运行以下命令重新测试并打开波形：

```sh
make wave
```

## 接口及时序

- `reset` 只将 PP 和 DP 清零，不清除统一内存，符合架构规范。
- `host_we` 用于程序装载和调试，优先级高于核心执行。
- `enable=1` 时，每个时钟上升沿完成一条完整指令。
- I/O 指令在上升沿前给出 `port_address` 和读写使能，传输在上升沿完成。
- `debug_pp`、`debug_dp` 和 `debug_word` 可连接逻辑分析器或调试界面。

当前行为级内存便于仿真和规范验证，但不保证综合器将其推断为特定 FPGA 的块 RAM。面向具体器件的同步 RAM、多周期 FETCH/EXEC 实现可以在保持架构语义不变的情况下后续增加。
