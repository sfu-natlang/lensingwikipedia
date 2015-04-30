FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 80

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && \
    apt-get install -y git python-pip apache2 libapache2-mod-wsgi

ADD . /opt/lensing

RUN chown www-data:www-data /var/www
RUN ln -s /opt/lensing/app.wsgi /var/www/lensing.wsgi

RUN pip install -r /opt/lensing/requirements.txt

RUN a2dissite 000-default
ADD deploy-config/ubuntu-virtualhost.conf /etc/apache2/sites-available/001-lensing.conf

RUN a2enmod wsgi
RUN a2ensite 001-lensing
CMD apache2ctl -D FOREGROUND
