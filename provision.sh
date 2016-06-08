#!/bin/bash

if [[ ! $UID -eq 0 ]]; then
	echo "You must be root to execute this script!"
	exit 1
fi

if [[ -f /etc/centos-release ]]; then

	CENTOS_VERSION=$(rpm -q --queryformat '%{VERSION}' centos-release)

	if [[ $CENTOS_VERSION -le 6 ]]; then
		echo "Your version of CentOS is too old."
		echo "Please upgrade to CentOS 7 or newer"
	fi

	yum -y install git screen wget curl
	yum -y groupinstall "Development tools"

	curl "https://bootstrap.pypa.io/get-pip.py" | python

	cat >/etc/yum.repos.d/docker.repo <<- 'EOF'
	[dockerrepo]
	name=Docker Repository
	baseurl=https://yum.dockerproject.org/repo/main/centos/$releasever
	enabled=1
	gpgcheck=1
	gpgkey=https://yum.dockerproject.org/gpg
	EOF

	yum -y check-update
	yum -y install docker-engine
	pip install docker-compose

	systemctl start docker.service
else
	echo "Automatic provisioning on non-CentOS servers is currently not supported."
fi
