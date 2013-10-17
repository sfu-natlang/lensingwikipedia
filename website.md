# Instructions to set up lensingwikipedia on a web server

This assumes a bare bones CentOS 6 install.

## Set up packages on CentOS 6

    sudo yum check-update
    sudo yum install git
    sudo yum install screen
    sudo yum groupinstall "Development tools"
    sudo yum install zlib-devel bzip2-devel openssl-devel ncurses-devel sqlite-devel readline-devel tk-devel

## Set up Python 2.7

    cd /tmp
    wget http://python.org/ftp/python/2.7.5/Python-2.7.5.tar.bz2
    tar xf Python-2.7.5.tar.bz2
    cd Python-2.7.5
    ./configure --prefix=/usr/local
    make && sudo make altinstall

## Set up easy_install, pip and whoosh

    wget https://pypi.python.org/packages/source/d/distribute/distribute-0.6.49.tar.gz
    tar xf distribute-0.6.49.tar.gz
    cd distribute-0.6.49
    sudo /usr/local/bin/python2.7 setup.py install
    sudo /usr/local/bin/easy_install-2.7 pip
    sudo /usr/local/bin/pip-2.7 install whoosh

## Set up web directory to pull from github.com/lensingwikipedia

    cd /var/www/html
    sudo vi index.html # see below
    sudo mkdir checkouts
    sudo chown anoop checkouts
    chgrp cs-natlang checkouts
    chmod g+w checkouts
    chmod g+s checkouts
    cd checkouts
    git clone https://github.com/sfu-natlang/lensingwikipedia.git 20131017 # use current date

### Sample index.html

    Welcome to cs-champ!
    <p><a href="http://cs-champ.cs.sfu.ca/lensingwikipedia.cs.sfu.ca">Lensing Wikipedia</a> by <a href="http://natlang.cs.sfu.ca">SFU Natlang Lab</a>

## Set up data files for backend

    cd /var/www/html
    sudo mkdir data
    sudo chown anoop data
    chgrp cs-natlang data
    chmod g+w data
    chmod g+s data
    cd data
    # create full.index in data/20131017 (use current date) using instructions in backend/README

## Set up space for deployed website

    cd /var/www/html
    sudo mkdir lensingwikipedia.cs.sfu.ca
    sudo chown anoop lensingwikipedia.cs.sfu.ca
    chgrp cs-natlang lensingwikipedia.cs.sfu.ca
    chmod g+w lensingwikipedia.cs.sfu.ca
    chmod g+s lensingwikipedia.cs.sfu.ca

## Run backend

    cd /var/www/html/checkouts/20131017/backend
    create full.conf # see below
    nohup python2.7 backend -p 1510 -c full.conf

### Sample full.conf

    {
      'server': {
        'index_dir_path': '/var/www/html/data/20131003/full.index'
      },
      'querier': {
      }
    }
    
## Configure frontend and deploy

    cd /var/www/html/checkouts/20131017/frontend
    create config.js  # see below
    create config.mk
    cp out/*.* /var/www/html/lensingwikipedia.cs.sfu.ca/.

### Sample config.js

    // URL for the backend
    backendUrl = "http://cs-champ.cs.sfu.ca:1510";
    // Prefix for links to Wikipedia pages
    baseWikipediaUrl = "https://en.wikipedia.org";
    // Range of allowed map zoom levels
    minMapZoom = 1, maxMapZoom = 5;
    // URL for the map data file (can be relative to the path where the frontend is running)
    mapDataUrl = "map.json";
    // List of facets by field name (to ask the backend for) and title (to show the user)
    facets = {
        "role": "Role",
        "personText": "Person",
        "currentCountryText": "Current country",
        "locationText": "Location"
    };

### Sample config.mk file

    MINCSS=cat
    MINJS=cat
