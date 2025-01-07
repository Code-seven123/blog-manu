import express, { Express, Response, Request } from "express"
import { logger } from "./src/winston-log"
import ejs from "ejs"
import { LRUCache } from "lru-cache"

const LRU: any = new LRUCache({
  max: 100
})

ejs.cache = LRU
const app: Express = express()
app.use(express.json())
app.set("view engine", "ejs")

app.get("/", (req: Request, res: Response) => {
  res.render("index")
})

app.listen(process.env.PORT, () => {
  logger.info(`Server is running on port ${process.env.PORT}`)
})