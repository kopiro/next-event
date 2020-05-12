FROM node:alpine
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["yarn", "start"]
COPY ./package.json ./yarn.lock ./
RUN yarn install --non-interactive --prod
COPY ./src ./src