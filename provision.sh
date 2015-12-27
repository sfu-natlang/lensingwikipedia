#!/bin/bash

if [ ! $UID -eq 0 ]; then
    echo "You must be root to execute this script!"
    exit 1
fi

yum -y install git screen wget
yum -y groupinstall "Development tools"
yum -y install zlib-devel bzip2-devel openssl-devel ncurses-devel sqlite-devel readline-devel tk-devel atlas-devel

cd $(mktemp -d)
wget http://python.org/ftp/python/2.7.8/Python-2.7.8.tgz
tar xf Python-2.7.8.tgz
cd Python-2.7.8
./configure --prefix=/usr/local
make && make altinstall

wget https://pypi.python.org/packages/source/d/distribute/distribute-0.6.49.tar.gz
tar xf distribute-0.6.49.tar.gz
cd distribute-0.6.49
/usr/local/bin/python2.7 setup.py install
/usr/local/bin/easy_install-2.7 pip

cat >/etc/yum.repos.d/docker.repo <<-EOF
[dockerrepo]
name=Docker Repository
baseurl=https://yum.dockerproject.org/repo/main/centos/6
enabled=1
gpgcheck=1
gpgkey=https://yum.dockerproject.org/gpg
EOF

yum -y check-update
yum -y install docker-engine

/usr/local/bin/pip2.7 install docker-compose
mkdir -p /etc/docker
