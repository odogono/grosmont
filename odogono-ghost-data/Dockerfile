FROM odogono/ghostnodejs

RUN mkdir -p /var/local/ghost
COPY ../content/ /var/local/ghost/content/

RUN echo "Created from odogon-ghost-data" > /var/local/ghost/content/notice.txt

VOLUME [ "/var/local/ghost" ]

CMD ["echo", "Data container for odogono ghost"]