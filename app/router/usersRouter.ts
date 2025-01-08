import express, { Router } from "express"
const router: Router = express.Router()

import UsersController from "../controller/usersController"

const usersController = new UsersController()

router.get("/logout", usersController.logout)
router.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

export default router