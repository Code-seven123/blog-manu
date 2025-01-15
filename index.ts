import express, { Express, Response, Request, NextFunction } from "express";
import { logger } from "./src/winston-log";
import ejs from "ejs";
import { LRUCache } from "lru-cache";
import { Blogs, Users } from "./database";
import he from "he";
import { faker, ne } from "@faker-js/faker";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { mainRouter, usersRouter, blogsRouter } from "./app";
import { join } from "path";
import cookieParser from "cookie-parser";
import expressWinston from "express-winston";
import { password } from "bun";
import TimeAgo from "javascript-time-ago"
import en from "javascript-time-ago/locale/en"
import helmet from "helmet"
import limiterRequest from "express-rate-limit"
import expressSession from "express-session"
import { CipherKey } from "crypto";
TimeAgo.addDefaultLocale(en)

export interface ExpressError extends Error {
  status?: number; // Status HTTP (opsional)
  code?: string;   // Kode khusus error (opsional)
  details?: any;   // Detail tambahan tentang error (opsional)
}

async function createBlogs() {
  try {
    const userAdmin = await Users.findOne({ where: { is_admin: true } });
    if (userAdmin && userAdmin.getDataValue("id")) {
      if (process.env.NODE_ENV === "development") {
        const blogs = [];
        for (let i = 0; i < 32; i++) {
          blogs.push({
            title: faker.lorem.sentence(),
            content: faker.lorem.paragraphs(3),
            image: faker.image.urlPicsumPhotos({
              width: 350,
              height: 200
            }),
            userId: userAdmin.getDataValue("id"),
          });
        }
        return await Blogs.bulkCreate(blogs);
      }
    } else {
      const passwordStr = "Pasword123#";
      const hashedPass = await password.hashSync(passwordStr, "bcrypt");
      const user = await Users.create({
        username: "admin",
        email: "admin@admin.com",
        password: hashedPass,
        is_admin: true,
        bio: "admin",
        otpVerify: true,
      });
      logger.info(`Created user admin\n\tEmail: ${user.dataValues.email}\n\tUsername: ${user.dataValues.username}\n\tPassword: ${passwordStr}\n`);
      if (process.env.NODE_ENV === "development") {
        const blogs = [];
        for (let i = 0; i < 32; i++) {
          blogs.push({
            title: faker.lorem.sentence(),
            content: faker.lorem.paragraphs(3),
            image: faker.image.urlPicsumPhotos({
              width: 350,
              height: 200,
              blur: 2,
            }),
            userId: user.getDataValue("id"),
          });
        }
        return await Blogs.bulkCreate(blogs);
      }
    }
  } catch (error) {
    logger.error("Error creating blogs:", error);
  }
}

createBlogs();

const LRU: any = new LRUCache({
  max: 100,
});

ejs.cache = LRU;

const app: Express = express();

const limiter = limiterRequest({
  windowMs: 15 * 60 * 1000,
  max: 100
})
if(process.env.NODE_ENV === "production") {
  app.use(limiter)
  app.use(helmet())
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SECRET_COOKIE_KEY));
app.use(
  expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: "HTTP {{req.method}} {{req.url}}",
    expressFormat: true,
    colorize: true,
  })
);
app.use(expressSession({
  secret: process.env.SECRET_SESSION_KEY as CipherKey,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: process.env.NODE_ENV === 'production',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: "strict"
  }
}))
app.set("views", join(__dirname, "resource/views"));
app.set("view engine", "ejs");

app.locals.he = he;
app.locals.userLogged = false;
app.locals.errorEjs = false;
app.locals.TimeAgo = new TimeAgo("en-US")
app.locals.successEjs = false

app.use((req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress) as string;
  req.session.ip = ip
  next()
})
app.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { token } = req.session
  try {
    if(!!token) {
      const decoded = jwt.verify(token, process.env.SECRET_JWT_KEY as Secret) as JwtPayload;
      const userExist = await Users.count({ where: { id: decoded._id } })
      if(userExist === 1) {
        if(decoded.otpVerify) {
          res.locals.user = decoded;
          req.session.token = token
          res.locals.userLogged = decoded.otpVerify ?? false;
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000
        }
      }
    }
  } catch (err) {
    logger.warn("Invalid JWT token");
  }
  next()
});


app.use((err:ExpressError, req: Request, res:Response, next:NextFunction) => {
  res.status(err.status || 500).render("error", {
      message: "Terjadi kesalahan pada server. Silakan coba lagi nanti.",
      error: process.env.NODE_ENV === "development" ? err : {}
  });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const param = req.query;
  res.locals.errorEjs = param.error;
  res.locals.successEjs = param.success
  next();
});

app.use("/", mainRouter);
app.use("/users", usersRouter);
app.use("/post", blogsRouter)

app.listen(process.env.PORT, () => {
  logger.info(`Server is running on port ${process.env.PORT}`);
});
