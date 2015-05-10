SRC?=.
OUT?=build

all: build

build: $(addprefix $(OUT)/, Readme.txt __init__.py bhtsne.py bh_tsne)

$(OUT)/%.txt: $(SRC)/%.txt
	@mkdir -p $(OUT)
	cp $^ $@

$(OUT)/%.py: $(SRC)/%.py
	@mkdir -p $(OUT)
	cp $^ $@

$(OUT)/bh_tsne: $(SRC)/quadtree.cpp $(SRC)/tsne.cpp
	@mkdir -p $(OUT)
	g++ -O3 -lcblas $^ -o $@
	mkdir -p $(OUT)/Temp

clean:
	rm -rf $(OUT)
