FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 1500

# MAINTAIN THE SAME ORDER OF USER CREATION BETWEEN ALL DOCKERFILES SO THAT THEY
# ALL END UP WITH THE SAME UID/GID
RUN groupadd -r lensing \
  && useradd -r -s /bin/false -g lensing lensing

ENV DEBIAN_FRONTEND noninteractive

RUN sed -i 's/archive\.ubuntu\.com/mirror.its.sfu.ca\/mirror/' /etc/apt/sources.list

RUN apt-get update && apt-get install -y python2.7 python-pip
RUN pip install whoosh

ADD . /opt/lensing

RUN cd /opt/lensing && make python

USER lensing

CMD /opt/lensing/build/backend -i /data/index/fullData.index
