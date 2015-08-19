FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 80

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && \
    apt-get install -y git python-pip apache2 libapache2-mod-wsgi

ADD . /opt/lensing
RUN chown -R www-data:www-data /opt/lensing
RUN find /opt/lensing -type f -exec chmod 664 "{}" \;
RUN find /opt/lensing -type d -exec chmod 775 "{}" \;

RUN cp /opt/lensing/app.wsgi /var/www/lensing.wsgi
RUN chown -R www-data:www-data /var/www

RUN pip install -r /opt/lensing/requirements.txt

RUN a2dissite 000-default
ADD deploy-config/ubuntu-virtualhost.conf /etc/apache2/sites-available/001-lensing.conf

RUN a2enmod wsgi
RUN a2ensite 001-lensing

# THIS CHMOD HAS TO BE HERE OR ELSE PYTHON CODE WON'T BE ABLE TO OPEN THE FILES
# EVEN THOUGH THE PERMISSIONS ARE 664 ON THESE FILES
CMD chmod 664 /opt/lensing/app/templates/* && apache2ctl -D FOREGROUND
