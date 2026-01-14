<p align="center">
  <a href="https://github.com/mathiascoutant/pechomax-frontend-mobile/" target="blank"><img src="https://cdn.discordapp.com/attachments/1226820829120036954/1227240273449582713/Pechomax__1_-removebg-preview.png?ex=66285852&is=662706d2&hm=36040edbfa06297a856ed180841b16bc4b78390ca86f4771b215cd3c4fc7f27f&" width="200" alt="Pechomax Logo" /></a>
</p>

<p align="center">A blazingly fast <a href="https://github.com/mathiascoutant/pechomax-frontend-mobile/" target="_blank">Forum</a> about fishing.</p>

## Description

This is the backend of the Pechomax project. It is a forum about fishing. It is made with [HonoJS](https://hono.dev/), a progressive Node.js framework for building efficient, reliable and scalable server-side applications.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ docker compose -f dev.docker-compose.yaml up -d
$ npm run dev
# launching on localhost:3000
```

```bash
# production mode
$ docker compose up -d
# launching on localhost/api
```

when running in production mode, `parent.docker-compose.yaml` and `parent.nginx.conf` are supposed to be placed in the parent directory of [pechomax-backend](https://github.com/mathiascoutant/pechomax-backend) and [pechomax-frontend-web](https://github.com/mathiascoutant/pechomax-frontend-web).
