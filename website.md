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

Set up docker version 1.7.1 or greater on Ubuntu on CentOS 6 or CentOS 7.
Installing on Ubuntu in easy. To install on CentOS follow the instructions in
the following page:

    http://blog.docker.com/2015/07/new-apt-and-yum-repos/

After you have installed using `sudo yum install docker-engine` then install
`docker-compose`:

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

## Configure and build the docker images

For the backend, the only configuration option available is whether you want
the 'wikipediahistory' or 'avherald' domains to be used. This can be chosen by
changing the `CONFIG` environment variable in `docker-compose.yml`.

The frontend configuration is modified using the `local_config.py` as explained
in `web/README.md`. Place the `local_config.py` file in the same directory as
`config.py` before you run `docker-compose build`, and it'll be added to the
image.

The defaults are set up to reflect the current directory structure and open
ports on `natlang-web.cs.sfu.ca`

Make sure you have permissions 664 on files and 755 on directories in `web/`

    cd repo
    find web -print -type f -exec chmod 664 {} \;
    find web -print -type d -exec chmod 755 {} \;

Then run the following commands:

    sudo /usr/local/bin/docker-compose build
    sudo /usr/local/bin/docker-compose up

## Localhost installation on macosx for offline demos

Download Docker Toolbox and follow instructions on this page:

    https://docs.docker.com/installation/mac/
    
Run `/Applications/Docker/Docker Quickstart Terminal` and you should see a Terminal window that looks like this:

                            ##         .
                      ## ## ##        ==
                   ## ## ## ## ##    ===
               /"""""""""""""""""\___/ ===
          ~~~ {~~ ~~~~ ~~~ ~~~~ ~~~ ~ /  ===- ~~~
               \______ o           __/
                 \    \         __/
                  \____\_______/
    docker is configured to use the default machine with IP 192.168.99.100
    For help getting started, check out the docs at https://docs.docker.com

You will use the IP address shown above to connect to the lensing server. 

For first time setup: set up the databases directory with the right permissions (more detailed instructions to come later). Then add the following line to `/etc/hosts`

    192.168.99.100  lensingwikipedia.me

Checkout the repository and download the data index files. Update `web/local_config.py` and `docker-compose.yml` to run as IP address shown above and provide the location of the data index files. Remove the `log_driver` and `log_opt` options from `docker-compose.yml` otherwise `docker-compose up` will terminate with an error. 

Make sure that `BACKEND_URL` in `local_config.py` uses the IP address from above, e.g.: 

    BACKEND_URL = "http://192.168.99.100:1500"

Then enter the following commands:

    docker run hello-world # to see if the install worked
    docker-compose build
    docker-compose up

Visit the IP address for your docker container at the port you selected in `docker-compose.yml` and you should see an running version of lensingwikipedia. Troubleshooting: if `nc -z 192.168.99.100 8080` reports that port 8080 is not serving requests then follow the instructions below to remove all containers and then run `docker-compose up` to see if that fixes the problem.

If you experience DNS issues, you can force Docker to use Google DNS servers by doing the following:

    eval "$(docker-machine env default)"
    DOCKER_OPTS="-dns 8.8.8.8 -dns 8.8.4.4"
    docker-machine restart default
    eval "$(docker-machine env default)"
    docker-machine ssh default

## Updating the site.

To update the site, pull the new version from github and rebuild the docker
images (using the same commands above).

When updating to a new docker image, you should check if the previous image was
terminated gracefully:

    sudo docker ps
    sudo docker kill CONTAINER-ID

## Deleting all Docker images and containers

### Containers

If you wish to remove all containers on the host, run the following command:

    sudo docker rm -f $(sudo docker ps -aq)

The `-f` means 'force' and is optional; it is useful when some containers are
still running, and you want to delete those too. Without `-f`, this command
won't kill running containers.

`docker ps` lists containers, `-a` means "all" (including stopped containers),
`-q` means "quiet" (only show IDs).

### Images

If you wish to remove all Docker images on the host, run the following command:

    sudo docker rmi $(sudo docker images -q)

`docker images` lists images, `-q` means "quiet" (only show IDs).
