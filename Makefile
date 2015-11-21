# This is useful to find docker-compose which seems to be installed in random
# places depending on how you install it (and where your package manager of
# choice put it). Just prepend paths as needed, and commit it.
export PATH := /usr/local/bin:$(HOME)/.local/bin:$(PATH)

OUT ?= build

deploy: DOCKER_HOST = tcp://lensingwikipedia.cs.sfu.ca:2376
deploy: DOCKER_TLS_VERIFY = 1
deploy: DOCKER_CERT_PATH = $(PWD)/keys/
deploy:
	sudo env "PATH=${PATH}" docker-compose build web
	sudo env "PATH=${PATH}" docker-compose build query
	sudo env "PATH=${PATH}" docker-compose up -d

dev:
	sudo env "PATH=${PATH}" docker-compose build web
	sudo env "PATH=${PATH}" docker-compose build query
	sudo env "PATH=${PATH}" docker-compose up

prepare-index-build:
	@mkdir -p $(OUT)
	@if ! sudo docker images | grep -q lensing-index; then \
		touch $(OUT)/.dockerignore; \
		sudo docker build -f ./backend/Dockerfile-makeindex -t lensing-index ./backend ; \
	else \
		echo "Image already built. Run 'make rm-index-image' first to rebuild"; \
	fi

index: prepare-index-build
	@if [ ! -f ${OUT}/fullData.json ]; then \
		echo "${OUT}/fullData.json is missing!"; \
		exit 1; \
	fi
	sudo docker run -i -t -v $(OUT):/build lensing-index
	sudo chown -R ${USER} ${OUT}

rm-index-image:
	sudo docker rmi -f lensing-index || true

clean:
	rm -rf $(OUT)

remove-containers:
	# || true because this will fail if there are no containers, but we want to
	# be able to run remove-images when there are no containers
	sudo docker rm --volumes -f $(shell sudo docker ps -aq) || true

remove-images: remove-containers
	sudo docker rmi $(shell sudo docker images -q)

.PHONY: clean dev remove-containers remove-images
