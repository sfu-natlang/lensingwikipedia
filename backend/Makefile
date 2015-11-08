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

all: query-backend bhtsne

query-backend:
	@mkdir -p $(OUT)
	find $(SRC) -maxdepth 1 \( -name '*.py' -o -executable \) \( -not -type d \) -exec cp {} $(OUT) \;
	cp -r domain_config $(OUT)

bhtsne:
	@mkdir -p $(OUT)
	SRC=$(SRC)/bhtsne OUT=$(OUT)/bhtsne $(MAKE) -f $(SRC)/bhtsne/Makefile build

build-image:
	@mkdir -p $(OUT)
	@if ! sudo docker images | grep -q lensing-index; then \
		touch $(OUT)/.dockerignore; \
		sudo docker build -f Dockerfile-makeindex -t lensing-index . ; \
	else \
		echo "Image already built. Run 'make rm-image' first to rebuild"; \
	fi

index: build-image
	@if [ ! -f ${OUT}/fullData.json ]; then \
		echo "${OUT}/fullData.json is missing!"; \
		exit 1; \
	fi
	sudo docker run -i -t -v $(PWD)/build:/build lensing-index

rm-image:
	sudo docker rmi -f lensing-index || true

clean:
	SRC=$(SRC)/bhtsne OUT=$(OUT)/bhtsne $(MAKE) -f $(SRC)/bhtsne/Makefile clean
	rm -rf $(OUT)
	@$(MAKE) rm-image

.PHONY: all query-backend bhtsne build-image index rm-image clean
