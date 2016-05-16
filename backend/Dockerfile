FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>

# MAINTAIN THE SAME ORDER OF USER CREATION BETWEEN ALL DOCKERFILES SO THAT THEY
# ALL END UP WITH THE SAME UID/GID
RUN groupadd -r lensing \
  && useradd -r -s /bin/false -g lensing lensing

ENV DEBIAN_FRONTEND noninteractive

RUN sed -i 's;archive.ubuntu.com;mirror.its.sfu.ca/mirror;' /etc/apt/sources.list

RUN apt-get update && apt-get install -y python2.7 python-pip python-dev
RUN pip install gevent uwsgi

ADD . /opt/lensing
RUN pip install -r /opt/lensing/requirements.txt

RUN cd /opt/lensing && make query-backend

USER lensing

CMD uwsgi --ini /opt/lensing/uwsgi.ini
