#
# Basic makefile to "compile" the backend by combining the main source files with configuration files.
#
# If you need to do local configuration changes, use Makefile.local in the directory you run make from.
#

SRC?=.
CONFIG?=config
OUT?=build

-include Makefile.local

build:
	@mkdir -p $(OUT)
	find $(SRC) -maxdepth 1 \( -name '*.py' -o -executable \) \( -not -type d \) -exec cp {} $(OUT) \;
	find $(CONFIG) -maxdepth 1 -name '*.py' -exec cp {} $(OUT) \;
	cp -r $(SRC)/bhtsne $(OUT)/
	cd $(OUT)/bhtsne
	g++ $(OUT)/bhtsne/quadtree.cpp $(OUT)/bhtsne/tsne.cpp -o $(OUT)/bhtsne/bh_tsne -O3 -L$(OUT)/bhtsne -lcblas
	mkdir -p $(OUT)/Temp
clean:
	rm -rf $(OUT)
