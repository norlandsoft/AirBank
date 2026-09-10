FROM postgres:16-alpine
COPY init/ /init/
ENTRYPOINT ["bash", "/init/01-create-databases.sh"]
