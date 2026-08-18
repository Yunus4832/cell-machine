`timescale 1ns/1ps

// Cell Machine 0.0.1 synthesizable SystemVerilog reference core.
//
// This implementation completes one architectural instruction on every
// enabled rising clock edge. Its behavioral unified memory favors readable
// simulation and specification validation over inference of a specific FPGA
// block-RAM primitive.
module cell_machine_core #(
  parameter int unsigned A = 8,
  localparam int unsigned W = A + 4,
  localparam int unsigned N = 1 << A
) (
  input  logic             clk,
  input  logic             reset,
  input  logic             enable,

  // Loader/debug access. A host write takes priority over execution.
  input  logic             host_we,
  input  logic [A-1:0]     host_addr,
  input  logic [W-1:0]     host_wdata,
  output logic [W-1:0]     host_rdata,

  // A transfer is requested while an I/O instruction is current and enable
  // is high. The transfer completes at the next rising clock edge.
  output logic [A-1:0]     port_address,
  output logic [W-1:0]     port_write_data,
  input  logic [W-1:0]     port_read_data,
  output logic             port_read_enable,
  output logic             port_write_enable,

  output logic [A-1:0]     debug_pp,
  output logic [A-1:0]     debug_dp,
  output logic [W-1:0]     debug_word
);
  logic [W-1:0] memory [0:N-1];
  logic [A-1:0] pp = '0;
  logic [A-1:0] dp = '0;

  logic [W-1:0] instruction;
  logic [W-1:0] current_word;
  logic [3:0]   opcode;
  logic [A-1:0] operand;
  logic [A-1:0] next_pp;
  logic [A-1:0] effective_address;

  integer i;
  initial begin
    for (i = 0; i < N; i = i + 1)
      memory[i] = '0;
  end

  assign instruction       = memory[pp];
  assign current_word      = memory[dp];
  assign opcode            = instruction[W-1:A];
  assign operand           = instruction[A-1:0];
  assign next_pp           = pp + 1'b1;
  assign effective_address = dp + operand;

  assign host_rdata       = memory[host_addr];
  assign debug_pp         = pp;
  assign debug_dp         = dp;
  assign debug_word       = instruction;
  assign port_address     = operand;
  assign port_write_data  = current_word;
  assign port_read_enable = enable && !reset && !host_we && (opcode == 4'he);
  assign port_write_enable = enable && !reset && !host_we && (opcode == 4'hf);

  always_ff @(posedge clk) begin
    if (reset) begin
      pp <= '0;
      dp <= '0;
    end else if (host_we) begin
      memory[host_addr] <= host_wdata;
    end else if (enable) begin
      // Fetch always increments PP before the decoded operation takes effect.
      pp <= next_pp;

      case (opcode)
        4'h0: dp <= dp + operand;                                      // >n
        4'h1: dp <= dp - operand;                                      // <n
        4'h2: memory[dp] <= current_word + {{4{1'b0}}, operand};        // +n
        4'h3: memory[dp] <= current_word - {{4{1'b0}}, operand};        // -n
        4'h4: memory[dp] <= {{4{1'b0}}, operand};                       // =n
        4'h5: if (current_word == '0) pp <= next_pp + operand;          // [n
        4'h6: if (current_word != '0) pp <= next_pp + operand;          // ]n
        4'h7: if (current_word == '0) pp <= operand;                    // (n
        4'h8: if (current_word != '0) pp <= operand;                    // )n
        4'h9: pp <= next_pp + operand;                                  // :n
        4'ha: pp <= operand;                                            // ;n
        4'hb: memory[effective_address] <= {{4{1'b0}}, next_pp};        // Pn
        4'hc: memory[effective_address] <= {{4{1'b0}}, dp};             // Dn
        4'hd: pp <= memory[effective_address][A-1:0];                    // @n
        4'he: memory[dp] <= port_read_data;                              // ,n
        4'hf: ;                                                          // .n
      endcase
    end
  end
endmodule
