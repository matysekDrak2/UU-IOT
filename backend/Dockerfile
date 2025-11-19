FROM ubuntu:latest
LABEL authors="Niraku Khas"

RUN apt-get update && apt-get install -y nodejs npm

COPY ./dao /app/dao
WORKDIR /app/dao
RUN npm install

COPY ./api /app/api
WORKDIR /app/api
RUN npm install

ENTRYPOINT ["./index.mjs"]