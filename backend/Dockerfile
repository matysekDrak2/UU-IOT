FROM node:18-alpine

LABEL authors="Niraku Khas"

WORKDIR /app

# copy package and source
COPY ./api/package.json ./api/package-lock.json* ./api/
COPY ./api/tsconfig.json ./api/
COPY ./api/src ./api/src
# dao is included inside api/src/dao per code below (no separate npm install needed)

WORKDIR /app/api

RUN npm install #ci --production=false

# build TS
RUN npm run build

EXPOSE 8080

CMD ["node", "dist/index.js"]
