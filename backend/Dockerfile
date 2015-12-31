FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 1500

# MAINTAIN THE SAME ORDER OF USER CREATION BETWEEN ALL DOCKERFILES SO THAT THEY
# ALL END UP WITH THE SAME UID/GID
RUN groupadd -r lensing \
  && useradd -r -s /bin/false -g lensing lensing

ENV DEBIAN_FRONTEND noninteractive

RUN sed -i 's/archive\.ubuntu\.com/mirror.its.sfu.ca\/mirror/' /etc/apt/sources.list

RUN apt-get update && apt-get install -y python2.7 python-pip python-dev uwsgi-core uwsgi-plugin-python

ADD . /opt/lensing
RUN pip install -r /opt/lensing/requirements.txt

RUN cd /opt/lensing && make query-backend

USER lensing

CMD uwsgi --plugin python,http --http :1500 --master --processes 2 --die-on-term --wsgi-file /opt/lensing/build/backend --callable app --env "RUNNING_IN_UWSGI=1" --pythonpath /opt/lensing/build
