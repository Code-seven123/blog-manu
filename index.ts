import express, { Express, Response, Request } from "express"
import { logger } from "./src/winston-log"
import ejs from "ejs"
import { LRUCache } from "lru-cache"
import { Blogs } from "./database"
import he from "he"
import { faker } from "@faker-js/faker"

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
const LRU: any = new LRUCache({
  max: 100
})

ejs.cache = LRU
const app: Express = express()
app.use(express.json())
app.set("view engine", "ejs")

app.locals.he = he
const pageSize: number = 6
app.get("/", async (req: Request, res: Response) => {
  const blogsData: Array<object> = await Blogs.findAll({ limit: pageSize || 6 })
  const sumPage: number = Math.ceil(blogsData.length / pageSize)
  res.render("index", { dataBlog: blogsData, page: sumPage, currentPage: 0 })
})
app.get("/:page", async (req: Request, res: Response) => {
  const page: number = parseInt(req?.params?.page, 10)
  const sumData: number = await Blogs.count()
  const sumPage: number = Math.ceil(sumData / pageSize)
  if(page <= 0) res.redirect("/");
  if(page > sumPage) res.redirect("/");
  const offset: number = (page - 1) * pageSize
  const blogsData: Array<object> = await Blogs.findAll({
    limit: pageSize || 6,
    offset: offset || 6
  })
  res.render("index", { dataBlog: blogsData, page: sumPage, currentPage: page  })
})

app.listen(process.env.PORT, () => {
  logger.info(`Server is running on port ${process.env.PORT}`)
})