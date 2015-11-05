FROM ubuntu:14.04
MAINTAINER Andrei Vacariu <andrei@avacariu.me>
EXPOSE 80

# MAINTAIN THE SAME ORDER OF USER CREATION BETWEEN ALL DOCKERFILES SO THAT THEY
# ALL END UP WITH THE SAME UID/GID
RUN groupadd -r lensing \
  && useradd -r -s /bin/false -g lensing lensing

ENV DEBIAN_FRONTEND noninteractive

RUN sed -i 's/archive\.ubuntu\.com/mirror.its.sfu.ca\/mirror/' /etc/apt/sources.list

RUN apt-get update && \
    apt-get install -y python-pip nginx-extras uwsgi-core uwsgi-plugin-python supervisor

ADD . /opt/lensing
RUN chown -R www-data:www-data /opt/lensing

RUN echo "daemon off;" >> /etc/nginx/nginx.conf
RUN rm /etc/nginx/sites-enabled/default
RUN ln -s /opt/lensing/deploy-config/nginx.conf /etc/nginx/sites-enabled/

# Get a new version of pip so we can use the fancy new requirements specifiers
RUN pip install --upgrade pip
RUN pip install -r /opt/lensing/requirements.txt

CMD ["supervisord", "-n", "-c", "/opt/lensing/deploy-config/supervisor.conf"]
