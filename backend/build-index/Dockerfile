FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 1500

# MAINTAIN THE SAME ORDER OF USER CREATION BETWEEN ALL DOCKERFILES SO THAT THEY
# ALL END UP WITH THE SAME UID/GID
RUN groupadd -r lensing \
  && useradd -r -s /bin/false -g lensing lensing

ENV DEBIAN_FRONTEND noninteractive

# install numpy, scipy, scikit-learn, using APT so that we don't have to deal
# with compilation issues such as CFLAGS being set because we're being run by a
# Makefile
RUN apt-get update && apt-get install -y build-essential python2.7 python2.7-dev python-pip libatlas-dev libatlas3-base libatlas-base-dev python-numpy python-scipy python-sklearn
RUN pip install whoosh nltk

RUN python2.7 -c 'import nltk; nltk.download("stopwords"); nltk.download("punkt")'

ADD . /opt/lensing

RUN cd /opt/lensing/build-index/bhtsne && make build

CMD rm -rf /build/index && mkdir -p /build/index && \
        python2.7 /opt/lensing/build-index/buildindex /build/index/fullData.index /build/fullData.json && \
        python2.7 /opt/lensing/build-index/cluster /build/index/fullData.index && \
        python2.7 /opt/lensing/build-index/tsne /build/index/fullData.index
