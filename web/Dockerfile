FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 80

# MAINTAIN THE SAME ORDER OF USER CREATION BETWEEN ALL DOCKERFILES SO THAT THEY
# ALL END UP WITH THE SAME UID/GID
RUN groupadd -r lensing \
  && useradd -r -s /bin/false -g lensing lensing

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && \
    apt-get install -y git python-pip apache2 libapache2-mod-wsgi

ADD . /opt/lensing
RUN chown -R www-data:www-data /opt/lensing

RUN cp /opt/lensing/app.wsgi /var/www/lensing.wsgi
RUN chown -R www-data:www-data /var/www

RUN pip install -r /opt/lensing/requirements.txt

RUN a2dissite 000-default
ADD deploy-config/ubuntu-virtualhost.conf /etc/apache2/sites-available/001-lensing.conf

RUN a2enmod wsgi
RUN a2ensite 001-lensing

# - Reason for `rm`: If the container isn't stopped gracefully, and Apache
#   didn't delete its lock files, it won't start up again (it'll say httpd is
#   already running).
CMD rm -rf /var/run/apache2/* /var/lock/apache2/* \
    && apache2ctl -D FOREGROUND
