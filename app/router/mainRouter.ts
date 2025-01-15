import express, { Router } from "express"
const router: Router = express.Router()

import MainController from "../controller/mainController"

const mainController = new MainController()

router.get("/", mainController.index)
router.get("/:page", mainController.page)

export default router