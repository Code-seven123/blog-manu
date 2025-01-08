import express, { Express, Response, Request, NextFunction } from "express"
import { logger } from "./src/winston-log"
import ejs from "ejs"
import { LRUCache } from "lru-cache"
import { Blogs } from "./database"
import he from "he"
import { faker } from "@faker-js/faker"
import session from "express-session"
import { CipherKey } from "crypto"
import jwt from "jsonwebtoken"
import { mainRouter, usersRouter } from "./app"
import { join } from "path"
import cookieParser from "cookie-parser"
import expressWinston from "express-winston"

async function createBlogs(id: number) {
  const blogs = [];

  for (let i = 0; i < 24; i++) {
    blogs.push({
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(3),
      image: faker.image.urlPicsumPhotos({
        width: 350,
        height: 200,
        blur: 2
      }),
      userId: id,
    });
  }

  return Blogs.bulkCreate(blogs);
}
// createBlogs(1)

const LRU: any = new LRUCache({
  max: 100
})

ejs.cache = LRU
const app: Express = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser(process.env.SECRET_COOKIE_KEY))
app.use(session({
  secret: process.env.SESSION_KEY as CipherKey ?? "secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 604800000
  }
}))
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",  // Pesan log yang dikustomisasi
  expressFormat: true, // Format log sesuai dengan standar express
  colorize: true
}))
app.set("views", join(__dirname, "resource/views"))
app.set("view engine", "ejs")


app.locals.he = he
app.locals.userLogged = false

app.use((req:Request, res:Response, next:NextFunction) => {
  const jwtSession = req.session.user
  res.locals.userLogged = jwtSession?.status ?? false
  if(jwtSession?.status && jwtSession?.token) {
    const encode = jwt.verify(jwtSession!.token!, process.env.SECRET_JWT_KEY)
    res.locals.user = encode
  }
  next()
})
app.use("/", mainRouter)
app.use("/users", usersRouter)

app.listen(process.env.PORT, () => {
  logger.info(`Server is running on port ${process.env.PORT}`)
})