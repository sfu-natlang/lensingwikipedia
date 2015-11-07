#
# Basic makefile to "compile" the backend by combining the main source files with configuration files.
#
# Put local changes to the makefile variables or system environment in
# Makefile.local. Use = for variables (like PATH) that need to override the
# environment, and ?= for any variables that you might want to override with
# the environment or commandline.
#

-include Makefile.local

SRC ?= src
OUT ?= build

build: python bhtsne

python:
	@mkdir -p $(OUT)
	find $(SRC) -maxdepth 1 \( -name '*.py' -o -executable \) \( -not -type d \) -exec cp {} $(OUT) \;
	cp -r domain_config $(OUT)

bhtsne:
	SRC=$(SRC)/bhtsne OUT=$(OUT)/bhtsne $(MAKE) -f $(SRC)/bhtsne/Makefile build

clean:
	SRC=$(SRC)/bhtsne OUT=$(OUT)/bhtsne $(MAKE) -f $(SRC)/bhtsne/Makefile clean
	rm -rf $(OUT)
