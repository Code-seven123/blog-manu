import { NextFunction, Request, Response } from "express";
import { logger } from "../../src/winston-log";

export default class MainController {
  public logout = async (req:Request, res:Response): Promise<void> => {
    req.session.destroy((err:Error | null) => {
      if(err) {
        logger.error("/logout \nCode: 500 \nMessage: Failed to destroy session")
        return res.status(500).send('Failed to destroy session');
      }
      res.clearCookie("connect.sid")
      res.redirect("/")
    })
  }
}