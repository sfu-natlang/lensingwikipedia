FROM ubuntu:16.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>

# MAINTAIN THE SAME ORDER OF USER CREATION BETWEEN ALL DOCKERFILES SO THAT THEY
# ALL END UP WITH THE SAME UID/GID
RUN groupadd -r lensing \
  && useradd -r -s /bin/false -g lensing lensing

ENV DEBIAN_FRONTEND noninteractive

# XXX: Uncomment this if it's convenient for you, but it's not good for
# production because sometimes you get "Hash sum mismatch"
#RUN sed -i 's;archive.ubuntu.com;mirror.its.sfu.ca/mirror;' /etc/apt/sources.list

RUN apt-get update && \
    apt-get install -y python3-pip uwsgi-core uwsgi-plugin-python3 libpq-dev

ADD . /opt/lensing
RUN chown -R www-data:www-data /opt/lensing

# Get a new version of pip so we can use the fancy new requirements specifiers
RUN pip3 install --upgrade pip

# pip freeze in a virtual env adds this line in, but you can't install it so
# pip install will fail if we don't remove the line
RUN bash -c "pip3 install -r <(sed '/pkg-resources==0.0.0/d' /opt/lensing/requirements.txt)"

CMD uwsgi --ini /opt/lensing/uwsgi.ini
