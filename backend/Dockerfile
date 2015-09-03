FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 1500

# MAINTAIN THE SAME ORDER OF USER CREATION BETWEEN ALL DOCKERFILES SO THAT THEY
# ALL END UP WITH THE SAME UID/GID
RUN groupadd -r lensing \
  && useradd -r -s /bin/false -g lensing lensing

ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get install -y build-essential python2.7 python-pip libatlas-dev libatlas3-base libatlas-base-dev
RUN pip install whoosh

ADD . /opt/lensing

RUN cd /opt/lensing && make

USER lensing

ENTRYPOINT ["/opt/lensing/build/backend"]
CMD ["-i", "/data/index/fullData.index"]
