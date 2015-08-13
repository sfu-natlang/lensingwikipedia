# Instructions to set up lensingwikipedia on a web server

This assumes a bare bones CentOS 6 install.

## Choose a domain

The instructions below assume we are building the main Lensing Wikipedia site.
We therefore use the config files in backend/domains/wikipediahistory/
directory for the backend and frontend. For a different domain use the
appropriate sub-directory in backend/domains/ instead, and adjust local paths
and URLs as needed.

## Set up packages on CentOS 6

    sudo yum check-update
    sudo yum install git
    sudo yum install screen
    sudo yum groupinstall "Development tools"
    sudo yum install zlib-devel bzip2-devel openssl-devel ncurses-devel sqlite-devel readline-devel tk-devel atlas-devel

## Set up Python 2.7

    cd /tmp
    wget http://python.org/ftp/python/2.7.8/Python-2.7.8.tgz
    tar xf Python-2.7.8.tgz
    cd Python-2.7.8
    ./configure --prefix=/usr/local
    make && sudo make altinstall

## Set up easy_install, pip and whoosh

    wget https://pypi.python.org/packages/source/d/distribute/distribute-0.6.49.tar.gz
    tar xf distribute-0.6.49.tar.gz
    cd distribute-0.6.49
    sudo /usr/local/bin/python2.7 setup.py install
    sudo /usr/local/bin/easy_install-2.7 pip
    sudo /usr/local/bin/pip-2.7 install whoosh
    sudo /usr/local/bin/pip-2.7 install numpy scipy scikit-learn nltk
    sudo python2.7 -c 'import nltk; nltk.download("all")'

## Set up docker on Ubuntu or CentOS 6/7

Set up docker version 1.7.1 or greater on Ubuntu on CentOS 6 or CentOS 7. Installing on Ubuntu in easy. To install on CentOS follow the instructions in the following page:

    http://blog.docker.com/2015/07/new-apt-and-yum-repos/

After you have installed using `sudo yum install docker-engine` then install `docker-compose`:

    sudo /usr/local/bin/pip-2.7 install docker-compose

## Get the data from the nightly crawl

These are instructions for the wikipedia crawl. The avherald and other domains
will be similar.

    cd /var/www/html/data/wikipedia
    scp linux.cs.sfu.ca:/cs/natlang-projects/users/maryam/wikiCrawler/Crawl_20150202/fullData.json . # (use the correct date)
    mkdir Crawl_20150202
    mv fullData.json Crawl_20150202
    rm -f latest
    ln -s Crawl_20150202 latest

## Set up data files for backend

    cd /var/www/html
    sudo mkdir data
    sudo chown anoop data
    chgrp cs-natlang data
    chmod g+w data
    chmod g+s data
    cd data
    # create full.index in data/wikipedia/latest (use current date) using instructions in the backend README
    python2.7 buildindex /var/www/html/data/wikipedia/latest/fullData.index /var/www/html/data/wikipedia/latest/fullData.json
    python2.7 cluster /var/www/html/data/wikipedia/latest/fullData.index
    python2.7 tsne /var/www/html/data/wikipedia/latest/fullData.index

## Build the docker images

When building the docker images, make sure the index you want to use is in
`/opt/lensing/data`, and then run the following command:

    cd repo
    sudo docker-compose build

## Configuring your images

For the backend, the only configuration option available is whether you want
the 'wikipediahistory' or 'avherald' domains to be used. This can be chosen by
changing the `CONFIG` environment variable in `docker-compose.yml`.

The frontend configuration is modified using the `local_config.py` as explained
in `web/README.md`. Place the `local_config.py` file in the same directory as
`config.py` before you run `docker-compose build`, and it'll be added to the
image.

## Run the docker containers

    cd repo
    sudo docker-compose up

## Updating the site.

To update the site, rebuild the docker images (using the same commands above).

