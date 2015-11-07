# This is useful to find docker-compose which seems to be installed in random
# places depending on how you install it (and where your package manager of
# choice put it). Just prepend paths as needed, and commit it.
export PATH := /usr/local/bin:$(HOME)/.local/bin:$(PATH)

deploy: DOCKER_HOST=tcp://lensingwikipedia.cs.sfu.ca:2376 DOCKER_TLS_VERIFY=1
	sudo env "PATH=${PATH}" docker-compose -f production.yml build web
	sudo env "PATH=${PATH}" docker-compose -f production.yml build query
	sudo env "PATH=${PATH}" docker-compose -f production.yml up -d

production:
	sudo env "PATH=${PATH}" docker-compose -f production.yml build web
	sudo env "PATH=${PATH}" docker-compose -f production.yml build query
	sudo env "PATH=${PATH}" docker-compose -f production.yml up -d

staging:
	sudo env "PATH=${PATH}" docker-compose -f staging.yml build web
	sudo env "PATH=${PATH}" docker-compose -f staging.yml build query
	sudo env "PATH=${PATH}" docker-compose -f staging.yml up

dev:
	sudo env "PATH=${PATH}" docker-compose -f development.yml build web
	sudo env "PATH=${PATH}" docker-compose -f development.yml build query
	sudo env "PATH=${PATH}" docker-compose -f development.yml up

clean:
	rm -rf ./build

remove-containers:
	# || true because this will fail if there are no containers, but we want to
	# be able to run remove-images when there are no containers
	sudo docker rm --volumes -f $(shell sudo docker ps -aq) || true

remove-images: remove-containers
	sudo docker rmi $(shell sudo docker images -q)

.PHONY: clean dev remove-containers remove-images
