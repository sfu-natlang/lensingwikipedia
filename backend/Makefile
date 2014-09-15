#
# Basic makefile to "compile" the backend by combining the main source files with configuration files.
#

SRC?=.
CONFIG?=config
OUT?=build

build:
	@mkdir -p $(OUT)
	find $(SRC) -maxdepth 1 \( -name '*.py' -o -executable \) \( -not -type d \) -exec cp {} $(OUT) \;
	find $(CONFIG) -maxdepth 1 -name '*.py' -exec cp {} $(OUT) \;
	cp -r $(SRC)/bhtsne $(OUT)/

clean:
	rm -rf $(OUT)
