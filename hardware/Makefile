IVERILOG ?= iverilog
VVP      ?= vvp
GTKWAVE  ?= gtkwave

BUILD := build
RTL   := rtl/cell_machine_core.sv
TB    := tb/tb_cell_machine_core.sv
SIM   := $(BUILD)/cell_machine_tb
VCD   := $(BUILD)/cell_machine.vcd

.PHONY: test wave clean

test: $(SIM)
	$(VVP) $(SIM)

$(SIM): $(RTL) $(TB)
	mkdir -p $(BUILD)
	$(IVERILOG) -g2012 -Wall -s tb_cell_machine_core -o $(SIM) $(RTL) $(TB)

wave: test
	$(GTKWAVE) $(VCD)

clean:
	rm -rf $(BUILD)
