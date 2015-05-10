#
# Basic makefile to "compile" the backend by combining the main source files with configuration files.
#
# If you need to do local configuration changes, use Makefile.local in the directory you run make from.
#

SRC?=.
CONFIG?=config
OUT?=build

-include Makefile.local

build: python bhtsne

python:
	@mkdir -p $(OUT)
	find $(SRC) -maxdepth 1 \( -name '*.py' -o -executable \) \( -not -type d \) -exec cp {} $(OUT) \;
	find $(CONFIG) -maxdepth 1 -name '*.py' -exec cp {} $(OUT) \;

bhtsne:
	SRC=$(SRC)/bhtsne OUT=$(OUT)/bhtsne $(MAKE) -f $(SRC)/bhtsne/Makefile build

clean:
	SRC=$(SRC)/bhtsne OUT=$(OUT)/bhtsne $(MAKE) -f $(SRC)/bhtsne/Makefile clean
	rm -rf $(OUT)
