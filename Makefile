# This is useful to find docker-compose which seems to be installed in random
# places depending on how you install it (and where your package manager of
# choice put it). Just prepend paths as needed, and commit it.
export PATH := /usr/local/bin:$(HOME)/.local/bin:$(PATH)

OUT ?= $(PWD)/build

include config.env
export $(shell sed 's/=.*//' config.env)

deploy: DOCKER_HOST = tcp://lensingwikipedia.cs.sfu.ca:2376
deploy: DOCKER_TLS_VERIFY = 1
deploy: DOCKER_CERT_PATH = $(PWD)/keys/
deploy:
	[ -e ./index ] || cp -al "${INDEX_PATH}" ./index
	sudo -E env "PATH=${PATH}" docker-compose build web
	sudo -E env "PATH=${PATH}" docker-compose build query
	sudo -E env "PATH=${PATH}" docker-compose up -d

prod:
	[ -e ./index ] || cp -al "${INDEX_PATH}" ./index
	sudo -E env "PATH=${PATH}" docker-compose build web
	sudo -E env "PATH=${PATH}" docker-compose build query
	sudo -E env "PATH=${PATH}" docker-compose up -d

staging:
	sudo -E env "PATH=${PATH}" docker-compose -f docker-compose.yml -f docker-compose.staging.yml build web
	sudo -E env "PATH=${PATH}" docker-compose -f docker-compose.yml -f docker-compose.staging.yml build query
	sudo -E env "PATH=${PATH}" docker-compose -f docker-compose.yml -f docker-compose.staging.yml up

# XXX MAKE SURE THAT ONLY THINGS USING dev.env ARE BELOW THIS LINE
include dev.env
export $(shell sed 's/=.*//' dev.env)
dev:
	[ -e ./index ] || cp -al "${INDEX_PATH}" ./index
	# set r/x flags for everyone since otherwise uwsgi in the docker container
	# won't be able to read/enter these directories
	find . -type d -exec chmod +rx "{}" \;
	find . -type f -exec chmod +r "{}" \;
	sudo -E env "PATH=${PATH}" docker-compose -f docker-compose.yml -f docker-compose.dev.yml build web
	sudo -E env "PATH=${PATH}" docker-compose -f docker-compose.yml -f docker-compose.dev.yml build query
	sudo -E env "PATH=${PATH}" docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

data-container-dev:
	[ -e ./index ] || cp -al "${INDEX_PATH}" ./index
	sudo -E env "PATH=${PATH}" docker-compose -f docker-compose.yml -f docker-compose.dev.yml build data

prepare-index-build:
	@mkdir -p $(OUT)
	touch $(OUT)/.dockerignore
	sudo docker build -f ./backend/build-index/Dockerfile -t lensing-index ./backend

index: prepare-index-build
	@if [ ! -f ${OUT}/fullData.json ]; then \
		echo "${OUT}/fullData.json is missing!"; \
		echo "Downloading a copy from S3..."; \
		wget https://s3.amazonaws.com/lensing.80x24.ca/fullData.json -O ${OUT}/fullData.json; \
	fi
	sudo docker run -i -t -v $(OUT):/build lensing-index
	sudo chown -R ${USER} ${OUT}

rm-index-image:
	sudo docker rmi -f lensing-index || true

clean:
	sudo rm -rf ${OUT}

remove-containers:
	# || true because this will fail if there are no containers, but we want to
	# be able to run remove-images when there are no containers
	sudo docker rm --volumes -f $(shell sudo docker ps -aq) || true

remove-images: remove-containers
	sudo docker rmi $(shell sudo docker images -q)

.PHONY: clean dev remove-containers remove-images
