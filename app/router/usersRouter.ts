import express, { Router } from "express"
import csrf from 'csurf';
const router: Router = express.Router()

import UsersController from "../controller/usersController"

const usersController = new UsersController()

const csrfProtection = csrf({ cookie: true })

router.get("/logout", usersController.logout)
router.get("/login", csrfProtection, usersController.login)
router.get("/register", csrfProtection, usersController.register)
router.post("/login", csrfProtection, usersController.loginRequest)
router.post("/register", csrfProtection, usersController.registerRequest)
router.get("/otp", csrfProtection, usersController.otp)
router.post("/verify-otp", csrfProtection, usersController.otpVerify)

export default router