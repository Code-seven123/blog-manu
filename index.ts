import express, { Express, Response, Request, NextFunction } from "express"
import { logger } from "./src/winston-log"
import ejs from "ejs"
import { LRUCache } from "lru-cache"
import { Blogs, Users } from "./database"
import he from "he"
import { faker } from "@faker-js/faker"
import session from "express-session"
import { CipherKey } from "crypto"
import jwt, { JwtPayload, Secret } from "jsonwebtoken"
import { mainRouter, usersRouter } from "./app"
import { join } from "path"
import cookieParser from "cookie-parser"
import expressWinston from "express-winston"
import { password } from 'bun';

async function createBlogs() {
  const userAdmin = await Users.findOne({ where: { is_admin: true } })
  if(userAdmin && userAdmin.getDataValue("userId")) {
    if(process.env.NODE_ENV === "development") {
      const blogs = [];
      for (let i = 0; i < 32; i++) {
        blogs.push({
          title: faker.lorem.sentence(),
          content: faker.lorem.paragraphs(3),
          image: faker.image.urlPicsumPhotos({
            width: 350,
            height: 200,
            blur: 2
          }),
          userId: userAdmin.getDataValue("userId"),
        });
      }
      return Blogs.bulkCreate(blogs);
    }
  } else {
    const passwordStr: string = "Pasword123#";
    const hashedPass: string = await password.hashSync(passwordStr, "bcrypt")
    const user = await Users.create({
      username: "admin",
      email: "admin@admin.com",
      password: hashedPass,
      is_admin: true,
      bio: "admin",
      otpVerify: true
    });
    logger.info(`Created user admin\nEmail: ${user.dataValues.email}\nUsername: ${user.dataValues.username}\nPassword: ${passwordStr}`)
    if(process.env.NODE_ENV === "development") {
      const blogs = [];
      for (let i = 0; i < 32; i++) {
        blogs.push({
          title: faker.lorem.sentence(),
          content: faker.lorem.paragraphs(3),
          image: faker.image.urlPicsumPhotos({
            width: 350,
            height: 200,
            blur: 2
          }),
          userId: user.getDataValue("userId"),
        });
      }
      return Blogs.bulkCreate(blogs);
    }
  }
}
createBlogs()

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
  msg: "HTTP {{req.method}} {{req.url}}", 
  expressFormat: true,
  colorize: true
}))
app.set("views", join(__dirname, "resource/views"))
app.set("view engine", "ejs")


app.locals.he = he
app.locals.userLogged = false
app.locals.errorEjs = false

app.use((req:Request, res:Response, next:NextFunction) => {
  const jwtSession = req.session.user
  if(jwtSession?.token) {
    const encode = jwt.verify(jwtSession!.token!, process.env.SECRET_JWT_KEY as Secret)
    res.locals.user = encode
    res.locals.userLogged = (encode as JwtPayload).otpVerify ?? false
  }
  next()
})
app.use((req:Request, res:Response, next:NextFunction) => {
  const param: string | null = req.query.error as string | null
  res.locals.errorEjs = param
  next()
})
app.use("/", mainRouter)
app.use("/users", usersRouter)

app.listen(process.env.PORT, () => {
  logger.info(`Server is running on port ${process.env.PORT}`)
})