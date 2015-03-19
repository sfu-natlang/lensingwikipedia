# Instructions for setting up LensingWikipedia on a Ubuntu 14.04 server

## The frontend

This guide will use Apache2 and `mod_wsgi` for setting up the frontend.

First, we'll need to install some packages.

    $ sudo apt-get install git python-pip apache2 libapache2-mod-wsgi

Next, we'll clone the repo. **Note** that we're not putting it in `/var/www`.
The reason is that Apache can serve files within `/var/www` and through some
accidental misconfiguration or bug it might give access to our private config
files.

    $ cd /opt
    $ sudo git clone https://github.com/sfu-natlang/lensingwikipedia.git

Although we're keeping the files separately, we'll keep a link to our `.wsgi`
file in `/var/www`:

    $ sudo mkdir /var/www/wsgi
    $ chown www-data:www-data /var/www/wsgi
    $ sudo ln -s /opt/lensingwikipedia/web/app.wsgi /var/www/wsgi/lensing.wsgi

For details on setting up Flask, see the README.md in `web/`. For the sake of
this guide, I'll show how to set up the bare basics so you can see the web page
(without the database).

    $ cd /opt/lensingwikipedia/web
    $ sudo pip install -r requirements.txt

### Apache2 VirtualHost

First, disable the existing `000-default.conf` site:

    $ sudo a2dissite 000-default

Next, create a file `/etc/apache2/sites-available/001-lensing.conf` and fill it
with the following:

    <VirtualHost *:80>
      ServerName lensingwikipedia.cs.sfu.ca
      ServerAdmin gripe@fas.sfu.ca

      WSGIDaemonProcess app user=www-data group=www-data threads=1
      WSGIScriptAlias / /var/www/wsgi/lensing.wsgi

      <Directory /var/www/wsgi>
        WSGIProcessGroup app
        WSGIApplicationGroup %{GLOBAL}
        Order deny,allow
        Allow from all
      </Directory>

      ## Logging
      ErrorLog /var/log/apache2/lensingwikipedia.cs.sfu.ca_error.log
      LogLevel warn
      ServerSignature Off
      CustomLog /var/log/apache2/lensingwikipedia.cs.sfu.ca_access.log combined

    </VirtualHost>

Finally, we need to enable `mod_wsgi`, the new config, and restart Apache2 to
reload the configs:

    $ sudo a2enmod wsgi
    $ sudo a2ensite 001-lensing
    $ sudo service apache2 restart

You can navigate to the website and you should see it work! We don't have the
query backend running yet, however, so it'll say "Loading..." everywhere
indefinitely.
