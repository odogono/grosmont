# see https://hub.docker.com/r/smebberson/alpine-nginx/
FROM smebberson/alpine-nginx

RUN echo "http://dl-1.alpinelinux.org/alpine/v3.3/main" >> /etc/apk/repositories; \
  echo "http://dl-2.alpinelinux.org/alpine/v3.3/main" >> /etc/apk/repositories; \
  echo "http://dl-3.alpinelinux.org/alpine/v3.3/main" >> /etc/apk/repositories; \
  echo "http://dl-4.alpinelinux.org/alpine/v3.3/main" >> /etc/apk/repositories; \
  echo "http://dl-5.alpinelinux.org/alpine/v3.3/main" >> /etc/apk/repositories

RUN apk --update add bash curl

ADD root /

# Nginx logs (access and error logs) aren't automatically streamed to stdout and stderr.
RUN ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log