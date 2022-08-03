FROM node:16.0.0-alpine

ADD . /app/

WORKDIR /app

RUN npm install && npm run build

CMD npm run start
