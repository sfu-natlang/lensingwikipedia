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
	ln -s /usr/lib64/libgslcblas.so.0 $(OUT)/bhtsne/libcblas.so
	cd $(OUT)/bhtsne
	g++ $(OUT)/bhtsne/quadtree.cpp $(OUT)/bhtsne/tsne.cpp -o $(OUT)/bhtsne/bh_tsne -O3 -I/cs/natlang-sw/Linux-x86_64/NL/LINALG/ATLAS/3.9.11/include -L$(OUT)/bhtsne -lcblas

clean:
	rm -rf $(OUT)
