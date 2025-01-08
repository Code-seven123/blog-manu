import express, { Router } from "express"
const router: Router = express.Router()

import MainController from "../controller/mainController"

const mainController = new MainController()

router.get("/", mainController.index)
router.get("/:page", mainController.page)
router.get("/:title", mainController.title)
router.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});
export default router