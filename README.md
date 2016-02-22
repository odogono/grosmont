https://github.com/mhart/alpine-node


images

odogono/www-nginx
odogono/www-ghost
odogono/www-ghost-data

Containers

odogono-nginx - nginx with conf - build with the root dir containing config
odogono-nginx-data - nginx data (caching)
odogono-ghost - nodejs ghost blog
odogono-ghost-data - data for ghost - /content dir



helped by https://engineering.riotgames.com/news/docker-jenkins-data-persists

### build the image
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




## adding a custom helper