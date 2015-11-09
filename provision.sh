#!/bin/bash
set -e

sudo yum install git screen wget
sudo yum groupinstall "Development tools"
sudo yum install zlib-devel bzip2-devel openssl-devel ncurses-devel sqlite-devel readline-devel tk-devel atlas-devel

cd $(mktemp -d)
wget http://python.org/ftp/python/2.7.8/Python-2.7.8.tgz
tar xf Python-2.7.8.tgz
cd Python-2.7.8
./configure --prefix=/usr/local
make && sudo make altinstall

wget https://pypi.python.org/packages/source/d/distribute/distribute-0.6.49.tar.gz
tar xf distribute-0.6.49.tar.gz
cd distribute-0.6.49
sudo /usr/local/bin/python2.7 setup.py install
sudo /usr/local/bin/easy_install-2.7 pip

cat >/etc/yum.repos.d/docker.repo <<-EOF
[dockerrepo]
name=Docker Repository
baseurl=https://yum.dockerproject.org/repo/main/centos/6
enabled=1
gpgcheck=1
gpgkey=https://yum.dockerproject.org/gpg
EOF

sudo yum check-update
sudo yum install docker-engine

sudo /usr/local/bin/pip2.7 install docker-compose
sudo mkdir -p /etc/docker
