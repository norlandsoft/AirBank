FROM curlimages/curl:8.8.0
USER root
COPY configs/ /configs/
COPY init/publish-configs.sh /publish-configs.sh
RUN chmod +x /publish-configs.sh && chmod -R a+r /configs
USER curl_user
ENTRYPOINT ["sh", "/publish-configs.sh"]
