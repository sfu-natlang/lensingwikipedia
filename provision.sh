#!/bin/bash

if [ ! $UID -eq 0 ]; then
	echo "You must be root to execute this script!"
	exit 1
fi

if [ -f /etc/centos-release ]; then
	CENTOS_VERSION=$(rpm -q --queryformat '%{VERSION}' centos-release)

	yum -y install git screen wget curl
	yum -y groupinstall "Development tools"

	if [ $CENTOS_VERSION -eq 6 ]; then
		yum -y install \
			zlib-devel \
			bzip2-devel \
			openssl-devel \
			ncurses-devel \
			sqlite-devel \
			readline-devel \
			tk-devel \
			atlas-devel

		cd $(mktemp -d)

		# XXX Update the starting point with the current version
		LATEST_PYTHON=10

		for x in $(seq ${LATEST_PYTHON} 100); do
			head_req=$(curl -I --silent https://www.python.org/ftp/python/2.7.$x/Python-2.7.$x.tgz)
			if grep --quiet --perl-regexp  "^HTTP/1\.1 200 OK" <(echo $head_req); then
				LATEST_PYTHON=$x
			else
				break
			fi
		done

		wget http://python.org/ftp/python/2.7.${LATEST_PYTHON}/Python-2.7.${LATEST_PYTHON}.tgz
		tar xf Python-2.7.8.tgz
		cd Python-2.7.8
		./configure --prefix=/usr/local
		make && make altinstall
	fi

	curl "https://bootstrap.pypa.io/get-pip.py" | python

	cat >/etc/yum.repos.d/docker.repo <<-EOF
	[dockerrepo]
	name=Docker Repository
	baseurl=https://yum.dockerproject.org/repo/main/centos/$CENTOS_VERSION
	enabled=1
	gpgcheck=1
	gpgkey=https://yum.dockerproject.org/gpg
	EOF

	yum -y check-update
	yum -y install docker-engine
	service docker start

	pip install docker-compose
fi
