import { NextFunction, Request, Response } from "express";
import { Blogs } from "../../database";
import { logger } from "../../src/winston-log";

export default class MainController {
  private pageSize: number = 6
  public index = async (req:Request, res:Response): Promise<void> => {
    try {
      const blogsData: Array<object> = await Blogs.findAll({ limit: this.pageSize })
      const sumPage: number = Math.ceil(blogsData.length / this.pageSize)
      res.render("index", { dataBlog: blogsData, page: sumPage, currentPage: 0 })
    } catch (error) {
      logger.error("Error index as mainController", error)
      res.status(500)
    }
  }
  public page = async (req:Request, res:Response): Promise<void> => {
    try {
      const page: number = parseInt(req?.params?.page, 10)
      const sumData: number = await Blogs.count()
      const sumPage: number = Math.ceil(sumData / this.pageSize)
      if(page <= 0) res.redirect("/");
      if(page > sumPage) res.redirect("/");
      const offset: number = (page - 1) * this.pageSize
      const blogsData: Array<object> = await Blogs.findAll({
        limit: this.pageSize || 6,
        offset: offset || 6
      })
      res.render("index", { dataBlog: blogsData, page: sumPage, currentPage: page  })
    } catch (error) {
      logger.error("Error index as mainController", error)
      res.status(500)
    }
  }
  public title = async (req:Request, res:Response): Promise<void> => {
    const title = req.params.title
  }
}