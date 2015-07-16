#
# Basic makefile to "compile" the backend by combining the main source files with configuration files.
#
# Put local changes to the makefile variables or system environment in
# Makefile.local. Use = for variables (like PATH) that need to override the
# environment, and ?= for any variables (like CONFIG) that you might want to
# override with the environment or commandline.
#

-include Makefile.local

SRC?=src
CONFIG?=wikipediahistory
OUT?=build

all:
	@mkdir -p $(OUT)
	find $(SRC) -maxdepth 1 \( -name '*.py' -o -executable \) \( -not -type d \) -exec cp {} $(OUT) \;
	find domains/$(CONFIG) -maxdepth 1 -name '*.py' -exec cp {} $(OUT) \;
	cp -r $(SRC)/bhtsne $(OUT)/
	if [ -e /etc/lsb-release ] && grep --quiet "Ubuntu" /etc/lsb-release; then \
		ln -s /usr/lib/libcblas.so $(OUT)/bhtsne/libcblas.so; \
	else \
		ln -s /usr/lib64/atlas/libcblas.so $(OUT)/bhtsne/libcblas.so; \
	fi
	cd $(OUT)/bhtsne
	g++ $(OUT)/bhtsne/quadtree.cpp $(OUT)/bhtsne/tsne.cpp -o $(OUT)/bhtsne/bh_tsne -O3 -L$(OUT)/bhtsne -lcblas
clean:
	rm -rf $(OUT)
