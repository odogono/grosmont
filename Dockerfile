# https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
# http://dailyjs.com/2015/04/23/migrating-dailyjs-to-ghost/
# http://crosbymichael.com/dockerfile-best-practices.html
# https://github.com/veggiemonk/awesome-docker
# https://github.com/smebberson/docker-alpine/tree/master/examples/user-nginx-nodejs

# https://github.com/mhart/alpine-node

FROM odogono/ghostnodejs



# Create app directory
# RUN mkdir -p /usr/src/app
WORKDIR /app

# Install app dependencies
COPY package.json /app/package.json
RUN cd /app && npm install --production

# Bundle app source
# COPY . /usr/src/app
COPY server.js /app/
COPY public/ /app/public/
COPY etc/ /app/etc/
RUN mkdir -p /var/local/ghost
COPY content/ /var/local/ghost/content/

# ADD root /

EXPOSE 2368

CMD [ "npm", "start" ]