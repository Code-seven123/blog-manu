import { NextFunction, Request, Response } from "express";
import { Blogs, Users } from "../../database";
import { Op } from "sequelize";

export default class MainController {
  public index = async (req:Request, res:Response): Promise<void> => {
    const title: string = req.params.title.replace("-", " ")
    const isExist = await Blogs.count({ where: {
      title: { [Op.like]: `%${title}%` }
    }})
    if(isExist <= 0) {
      return res.redirect("/")
    }
    const data = await Blogs.findOne({
      raw: true,
      include: [
        {
          model: Users,
          as: "user",
          attributes: [ "id", "username" ]
        }
      ],
      where: {
        title: { [Op.like]: `%${title}%` }
      }
    })
    if(!!data) {
      res.render("blogs", { data })
    } else {
      res.render("404")
    }
  }
}