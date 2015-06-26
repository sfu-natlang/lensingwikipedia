FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 1500

ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get install -y build-essential libatlas-dev libatlas3-base libatlas-base-dev

ADD . /opt/lensing

RUN cd /opt/lensing && make

ENTRYPOINT ["/opt/lensing/build/backend"]
CMD ["-i", "/var/lensing/data.index"]
