FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 3035

# MAINTAIN THE SAME ORDER OF USER CREATION BETWEEN ALL DOCKERFILES SO THAT THEY
# ALL END UP WITH THE SAME UID/GID
RUN groupadd -r lensing \
  && useradd -r -s /bin/false -g lensing lensing

ENV DEBIAN_FRONTEND noninteractive

RUN sed -i 's;archive.ubuntu.com;mirror.its.sfu.ca/mirror;' /etc/apt/sources.list

RUN apt-get update && \
    apt-get install -y python-pip uwsgi-core uwsgi-plugin-python

ADD . /opt/lensing
RUN chown -R www-data:www-data /opt/lensing

# Get a new version of pip so we can use the fancy new requirements specifiers
RUN pip install --upgrade pip
RUN pip install -r /opt/lensing/requirements.txt

CMD uwsgi --ini /opt/lensing/uwsgi.ini
