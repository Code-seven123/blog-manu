import express, { Router } from "express"
import csrf from 'csurf';
const router: Router = express.Router()

import BlogsController from "../controller/blogsController"

const usersController = new BlogsController()

const csrfProtection = csrf({ cookie: true })

router.get("/:title", usersController.index)

export default router