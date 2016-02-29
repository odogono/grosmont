

### Inspiro-Blogs

https://sivers.org/

NOTE : currently you have to build odogono-ghost-nodejs first before docker-compose

running site:
sudo docker-compose up -d


### images

odogono/nginx - nginx with conf - build with the root dir containing config
    - uses /data/nginx - for cache

odogono/nodejs - nodejs + ghost installation

odogono/ghost - odgn specific instance of ghost
    - uses /var/local/ghost for data

odogono/ghost-data

sudo docker network create app




helped by https://engineering.riotgames.com/news/docker-jenkins-data-persists

### build the container
docker build -t odogono-data .

### create an image from the data
docker run --name=odogono-data-inst odogono-data

### create a test container with the volumes defined in the data instance
docker run -it --name=odogono-testy-data --volumes-from=odogono-data-inst odogono/alpine-nodejs-ghost /bin/bash

### the difference with this is that it maps an existing directory - and keeps that mapping - not what we want
docker run --name odogono-data-2 -v $PWD/content:/var/odogono2-data odogono/alpine-nodejs-ghost echo odogono data 2


docker run -r --name=odogono-www -it odogono/www /bin/bash


## nginx conf

copying of /etc/nginx has to be done when the image is built


## SSL certificates

https://github.com/hlandau/acme


## adding a custom helper