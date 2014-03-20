# Instructions to set up lensingwikipedia on a web server

This assumes a bare bones CentOS 6 install.

## Choose a domain

The instructions below assume we are building the main Lensing Wikipedia site. We therefore use the domains/wikipediahistory/ directory for the backend and frontend. For a different domain use the appropriate sub-directory in domains/ instead, and adjust local paths and URLs as needed.

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

    Welcome to natlang-web!
    <p><a href="http://natlang-web.cs.sfu.ca/lensingwikipedia.cs.sfu.ca">Lensing Wikipedia</a> by <a href="http://natlang.cs.sfu.ca">SFU Natlang Lab</a>

## Set up space for deployed website

    cd /var/www/html
    sudo mkdir lensingwikipedia.cs.sfu.ca
    sudo chown anoop lensingwikipedia.cs.sfu.ca
    chgrp cs-natlang lensingwikipedia.cs.sfu.ca
    chmod g+w lensingwikipedia.cs.sfu.ca
    chmod g+s lensingwikipedia.cs.sfu.ca

## Set up apache to provide URL alias

    edit /etc/httpd/conf/httpd.conf to include the following line:
        Include /etc/httpd/sites-enabled/*.conf
    create file /etc/httpd/sites-available/lensingwikipedia.cs.sfu.ca.conf # see below
    symlink above file to /etc/httpd/sites-enabled/lensingwikipedia.cs.sfu.ca.conf

### sites-available/lensingwikipedia.cs.sfu.ca.conf 

    <VirtualHost lensingwikipedia.cs.sfu.ca:80>
      ServerName lensingwikipedia.cs.sfu.ca
      ServerAdmin gripe@fas.sfu.ca

      ## Vhost docroot
      DocumentRoot /var/www/html/lensingwikipedia.cs.sfu.ca
      <Directory /var/www/html/lensingwikipedia.cs.sfu.ca>
        Options -Indexes FollowSymLinks MultiViews
        AllowOverride None
        Order allow,deny
        allow from all
      </Directory>

      ## Logging
      ErrorLog /var/log/httpd/lensingwikipedia.cs.sfu.ca_error.log
      LogLevel warn
      ServerSignature Off
      CustomLog /var/log/httpd/lensingwikipedia.cs.sfu.ca_access.log combined

    </VirtualHost>

## Build backend

To use the backend we first need to build the domain-specific programs.

    cd /var/www/html/checkouts/20131017/domains/wikipediahistory
    make backend

Now the appropriate programs are in `/var/www/html/checkouts/20131017/domains/wikipediahistory/backend`

## Set up data files for backend

    cd /var/www/html
    sudo mkdir data
    sudo chown anoop data
    chgrp cs-natlang data
    chmod g+w data
    chmod g+s data
    cd data
    # create full.index in data/20131017 (use current date) using instructions in the backend README
    python2.7 buildindex /var/www/html/data/20131017/fullData.20131017.index /var/www/html/data/20131017/fullData.20131017.json
    python2.7 cluster /var/www/html/data/20131017/fullData.20131017.index

## Run backend

    cd /var/www/html/checkouts/20131017/domains/wikipediahistory/backend
    # create full.conf as below
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

    cd /var/www/html/checkouts/20131017/domains/wikipediahistory
    make frontendsettings.mk frontendsettings.js
    # edit frontendsettings.js to match the sample below

### Sample frontendsettings.js

    // URL for the backend.
    backendUrl = "http://natlang-web.cs.sfu.ca:1510";

The make command above creates default settings files. If you already have your own use them instead. If you want to do any Javascript or CSS minimization set commands in frontendsettings.mk. See the frontend README for more details on settings.

    make release
    cp release/*.* /var/www/html/lensingwikipedia.cs.sfu.ca/.

# Update the website

## Restart backend

    cd /var/www/html/checkouts/20131017/domains/wikipediahistory/backend
    nohup python2.7 backend -p 1510 -c full.conf

Note that you do not always need to restart the backed to change to new data; see the backend README.

## Pull new frontend and deploy

    cd /var/www/html/checkouts/20131017/domains/wikipediahistory
    git pull
    make release
    cp release/*.* /var/www/html/lensingwikipedia.cs.sfu.ca/.
