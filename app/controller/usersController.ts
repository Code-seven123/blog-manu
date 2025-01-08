import { NextFunction, Request, Response } from "express";
import { logger } from "../../src/winston-log";
import jwt from "jsonwebtoken";
import { Blogs, Users } from "../../database";
import { z, ZodError, ZodErrorMap } from "zod";
import { password } from "bun";
import { verify } from './../../node_modules/@types/jsonwebtoken/index.d';

export default class MainController {
  private usernameSchema = z.string().min(4, { message: "Username harus lebih dari 4 kata." }).max(100, { message: "Username tidak boleh lebih dari 100 kata" }).refine(async (value: string) => {
    const user = await Users.count({ where: { username: value } })
    return user === 0;
  }, { message: "Username sudah ada" })
  private bioSchema = z.string().max(200, { message: "Bio tidak boleh lebih dari 200 kata" }).optional()
  private emailSchema = z.string().email({ message: "Email tidak valid." }).max(255, { message: "Email tidak boleh lebih dari 255 kata" }).refine(async (value: string) => {
    const user = await Users.count({ where: { email: value } })
    return user === 0;
  }, { message: "Email sudah ada" })
  private passwordSchema = z.string().min(8, { message: "Password harus memiliki minimal 6 karakter." }).refine((value: string) => {
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value)
    const hasUppercase = /[A-Z]/.test(value)
    const hasNumber = /\d/.test(value);
    return hasSpecialChar && hasUppercase && hasNumber;
  }, {
    message: "Password harus mengandung karakter khusus, huruf kapital, dan angka.",
  });
  private handleValidationErrors = (error: ZodError):string => {
    return error.errors
      .map((err:any) => err.message)
      .join(", ")
  }
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
  // login intance
  public login = async (req:Request, res: Response): Promise<void> => {
    if(res.locals.userLogged) res.redirect("/");
    res.render("auth/login", { csrf: req.csrfToken(), message: false })
  }
  public loginRequest = async (req:Request, res: Response, next: NextFunction) => {
    if(res.locals.userLogged) res.redirect("/");
    interface DataClient {
      email: string;
      password: string;
    }
    const dataClient: DataClient = req.body
    try {
      this.emailSchema.parse(dataClient.email)
      this.passwordSchema.parse(dataClient.password)
      try {
        const user = await Users.findOne({ where: { email: dataClient.email } })
        if(user?.getDataValue.length === 1) {
          const verify: boolean = await password.verifySync(dataClient!.password, user!.password, "bcrypt")
          if(verify) {
            const jwtSession: string = jwt.sign({ _id: user!.userId, email: user!.email, name: user!.username }, process.env.SECRET_JWT_KEY, {
              expiresIn: "30 days"
            })
            req.session.user = { status: true, token: jwtSession }
            res.locals.userLogged = true
            res.cookie("login", req.sessionID, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              maxAge: 7 * 24 * 60 * 60 * 1000
            })
            res.redirect("/")
          }
        } else {
          return res.render("auth/login", { message: "User tidak ditemukan", csrf: req.csrfToken() })
        }
    } catch (error: unknown) {
      if(error instanceof ZodError) {
        const errorMessage: string = this.handleValidationErrors(error);
        return res.render("auth/login", {
          message: errorMessage,
          csrf: req.csrfToken
        })
      }
      next()
    }
    } catch (error) {
      return res.render("auth/login", {
        message: "Kesalahan tidak terduga",
        csrf: req.csrfToken
      })
    }
  }

  // registery intance
  public register = async (req:Request, res: Response): Promise<void> => {
    if(res.locals.userLogged) res.redirect("/");
    res.render("auth/register", { csrf: req.csrfToken(), message: false })
  }
  public registerRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (res.locals.userLogged) return res.redirect("/");
  
    interface DataClient {
      username: string;
      email: string;
      password: string;
      password2: string;
      bio: string;
    }
  
    const dataClient: DataClient = req.body;
  
    try {
      // Validasi menggunakan Zod
      await this.usernameSchema.parseAsync(dataClient.username);
      await this.emailSchema.parseAsync(dataClient.email);
      await this.passwordSchema.parse(dataClient.password);
      await this.passwordSchema.parse(dataClient.password2);
      await this.bioSchema.parse(dataClient.bio);
  
      // Periksa apakah password dan password2 cocok
      if (dataClient.password !== dataClient.password2) {
        return res.render("auth/register", {
          message: "Password tidak sama",
          csrf: req.csrfToken(),
        });
      }
  
      // Hashing password
      const hashedPassword: string = await password.hashSync(dataClient.password, "bcrypt");
  
      // Menciptakan user baru
      const newUser = await Users.create({
        username: dataClient.username,
        email: dataClient.email,
        password: hashedPassword,
        bio: dataClient.bio,
        is_admin: false,
      });
  
      // Membuat JWT session
      const jwtSession: string = jwt.sign(
        {
          _id: newUser.dataValues.userId,
          email: newUser.dataValues.email,
          name: newUser.dataValues.username,
        },
        process.env.SECRET_JWT_KEY,
        {
          expiresIn: "30 days",
        }
      );
  
      // Menyimpan informasi sesi dan redirect
      req.session.user = { status: true, token: jwtSession };
      res.locals.userLogged = true;
      res.cookie("login", req.sessionID, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
  
      res.redirect("/");
  
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const errorMessage = this.handleValidationErrors(error);
        return res.render("auth/register", {
          message: errorMessage,
          csrf: req.csrfToken(),
        });
      } else {
        next(error);
      }
    }
  };
  
}