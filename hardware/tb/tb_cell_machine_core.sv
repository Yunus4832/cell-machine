`timescale 1ns/1ps

module tb_cell_machine_core;
  localparam int unsigned A = 4;
  localparam int unsigned W = A + 4;

  logic clk = 0;
  logic reset = 0;
  logic enable = 0;
  logic host_we = 0;
  logic [A-1:0] host_addr = '0;
  logic [W-1:0] host_wdata = '0;
  logic [W-1:0] host_rdata;
  logic [A-1:0] port_address;
  logic [W-1:0] port_write_data;
  logic [W-1:0] port_read_data = '0;
  logic port_read_enable;
  logic port_write_enable;
  logic [A-1:0] debug_pp;
  logic [A-1:0] debug_dp;
  logic [W-1:0] debug_word;

  always #5 clk = ~clk;

  cell_machine_core #(.A(A)) dut (.*);

  task automatic load_word(input logic [A-1:0] address,
                           input logic [W-1:0] data);
    begin
      @(negedge clk);
      enable = 0;
      host_addr = address;
      host_wdata = data;
      host_we = 1;
      @(posedge clk);
      #1 host_we = 0;
    end
  endtask

  task automatic reset_core;
    begin
      @(negedge clk);
      enable = 0;
      host_we = 0;
      reset = 1;
      @(posedge clk);
      #1 reset = 0;
    end
  endtask

  task automatic step;
    begin
      @(negedge clk);
      enable = 1;
      @(posedge clk);
      #1 enable = 0;
    end
  endtask

  task automatic expect_memory(input logic [A-1:0] address,
                               input logic [W-1:0] expected,
                               input string label_text);
    begin
      host_addr = address;
      #1;
      if (host_rdata !== expected)
        $fatal(1, "%s: memory[%0h]=%0h, expected %0h",
               label_text, address, host_rdata, expected);
    end
  endtask

  task automatic expect_pointer(input logic [A-1:0] expected_pp,
                                input logic [A-1:0] expected_dp,
                                input string label_text);
    begin
      #1;
      if (debug_pp !== expected_pp || debug_dp !== expected_dp)
        $fatal(1, "%s: PP=%0h DP=%0h, expected PP=%0h DP=%0h",
               label_text, debug_pp, debug_dp, expected_pp, expected_dp);
    end
  endtask

  initial begin
    $dumpfile("build/cell_machine.vcd");
    $dumpvars(0, tb_cell_machine_core);

    // Pointer and arithmetic instructions: >, =, +, -, <.
    load_word(4'h0, 8'h08); // >8
    load_word(4'h1, 8'h43); // =3
    load_word(4'h2, 8'h22); // +2
    load_word(4'h3, 8'h31); // -1
    load_word(4'h4, 8'h11); // <1
    reset_core();
    step(); expect_pointer(4'h1, 4'h8, "> pointer move");
    step(); expect_memory(4'h8, 8'h03, "= assign");
    step(); expect_memory(4'h8, 8'h05, "+ add");
    step(); expect_memory(4'h8, 8'h04, "- subtract");
    step(); expect_pointer(4'h5, 4'h7, "< pointer move");

    // Relative/absolute control flow: [, (, ; and address wraparound.
    load_word(4'h0, 8'h08); // >8 (memory[8] is cleared below)
    load_word(4'h1, 8'h52); // [2: zero jumps from PP=2 to 4
    load_word(4'h2, 8'h4f); // skipped
    load_word(4'h3, 8'h4f); // skipped
    load_word(4'h4, 8'h76); // (6: zero jumps absolutely
    load_word(4'h5, 8'h4f); // skipped
    load_word(4'h6, 8'ha9); // ;9
    load_word(4'h8, 8'h00); // zero data / >0
    load_word(4'h9, 8'h9f); // :F: fixed point (10 + 15 wraps to 9)
    reset_core();
    step(); step(); expect_pointer(4'h4, 4'h8, "relative JZ");
    step(); expect_pointer(4'h6, 4'h8, "absolute JZ");
    step(); expect_pointer(4'h9, 4'h8, "absolute jump");
    step(); expect_pointer(4'h9, 4'h8, "relative wraparound jump");

    // Non-zero conditionals: ] and ).
    load_word(4'h0, 8'h0f); // >F
    load_word(4'h1, 8'h41); // =1
    load_word(4'h2, 8'h62); // ]2 -> address 5
    load_word(4'h5, 8'h87); // )7
    load_word(4'h7, 8'h9f); // :F -> address 7
    load_word(4'hf, 8'h00); // data
    reset_core();
    step(); step(); step(); expect_pointer(4'h5, 4'hf, "relative JNZ");
    step(); expect_pointer(4'h7, 4'hf, "absolute JNZ");

    // Pointer reflection and indirect execution: P, D, @.
    load_word(4'h0, 8'h08); // >8
    load_word(4'h1, 8'hb0); // P0: memory[8] = next PP = 2
    load_word(4'h2, 8'hc1); // D1: memory[9] = DP = 8
    load_word(4'h3, 8'hd0); // @0: PP = low(memory[8]) = 2
    load_word(4'h8, 8'h00);
    load_word(4'h9, 8'h00);
    reset_core();
    step(); step(); expect_memory(4'h8, 8'h02, "P reflection");
    step(); expect_memory(4'h9, 8'h08, "D reflection");
    step(); expect_pointer(4'h2, 4'h8, "indirect jump");

    // Input instruction presents its address before sampling data.
    load_word(4'h0, 8'h08); // >8
    load_word(4'h1, 8'he2); // ,2
    load_word(4'h8, 8'h00);
    reset_core();
    step();
    @(negedge clk);
    port_read_data = 8'ha5;
    enable = 1;
    #1;
    if (!port_read_enable || port_address !== 4'h2)
      $fatal(1, "input request was not presented before the active edge");
    @(posedge clk); #1 enable = 0;
    expect_memory(4'h8, 8'ha5, "port input");

    // Output and the all-zero >0 NOP encoding.
    load_word(4'h0, 8'h08); // >8
    load_word(4'h1, 8'h43); // =3
    load_word(4'h2, 8'hf1); // .1
    reset_core();
    step(); step();
    @(negedge clk);
    enable = 1;
    #1;
    if (!port_write_enable || port_address !== 4'h1 || port_write_data !== 8'h03)
      $fatal(1, "output request mismatch");
    @(posedge clk); #1 enable = 0;
    expect_pointer(4'h3, 4'h8, "port output");

    $display("PASS: all 16 Cell Machine opcodes and interfaces verified");
    $finish;
  end
endmodule
