import { NextFunction, Request, Response } from "express";
import { logger } from "../../src/winston-log";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { Users } from "../../database";
import { z, ZodError, ZodIssue } from "zod";
import { password } from "bun";
import Nodemailer from "../../src/nodemailer";

export default class UsersController {
  private usernameSchema = z
    .string()
    .min(4, { message: "Username harus lebih dari 4 karakter." })
    .max(100, { message: "Username tidak boleh lebih dari 100 karakter" })
    .refine(async (value: string) => {
      const user = await Users.count({ where: { username: value } });
      return user === 0;
    }, { message: "Username sudah ada" });

  private bioSchema = z
    .string()
    .max(200, { message: "Bio tidak boleh lebih dari 200 karakter" })
    .optional();

  private emailSchema = z
    .string()
    .email({ message: "Email tidak valid." })
    .max(255, { message: "Email tidak boleh lebih dari 255 karakter" })
    .refine(async (value: string) => {
      const user = await Users.count({ where: { email: value } });
      return user === 0;
    }, { message: "Email sudah ada" });

  private emailLoginSchema = z
    .string()
    .email({ message: "Email tidak valid." })
    .max(255, { message: "Email tidak boleh lebih dari 255 karakter" });

  private passwordSchema = z
    .string()
    .min(8, { message: "Password harus memiliki minimal 8 karakter." })
    .refine((value: string) => {
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
      const hasUppercase = /[A-Z]/.test(value);
      const hasNumber = /\d/.test(value);
      return hasSpecialChar && hasUppercase && hasNumber;
    }, {
      message: "Password harus mengandung karakter khusus, huruf kapital, dan angka.",
    });

  private otpSchema = z
    .string()
    .length(6, { message: "Otp harus memiliki panjang 6" })

  private handleValidationErrors = (error: ZodError): string => {
    if (!error.errors || !Array.isArray(error.errors)) {
      return "Unknown validation error";
    }
    return error.errors
      .map((err: ZodIssue) => err.message || "Unknown error")
      .join(", ");
  };
  private createLogin = async (req:Request, res:Response, userId:number): Promise<boolean> => {
    if(!(req.session.ip ?? "127.0.0.1" === req.ip)) return false;
    try {
      const user = await Users.findOne({ raw: true, where: { id: userId } })
      const jwtSession: string = jwt.sign({
        _id: user?.id,
        email: user?.email,
        name: user?.username,
        otpVerify: user?.otpVerify as boolean,
      }, process.env.SECRET_JWT_KEY as Secret, { expiresIn: "30 days" });
      req.session.ip = req.ip
      req.session.token = jwtSession
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000
      res.locals.userLogged = true
      return true
    } catch (error) {
      logger.error("error create login instance", error)
      return false
    }
  }

  // logout instance
  public logout = async (req: Request, res: Response): Promise<void> => {
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).send("Gagal untuk menginisialisasi ulang sesi.");
      }
  
      // Sekarang sesi baru dimulai, Anda bisa menghapus data sesi atau menandai pengguna sebagai logout
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).send("Gagal menghancurkan sesi.");
        }
        
        // Menghapus cookie sesi
        res.clearCookie("connect.sid");
        res.redirect("/?success=logout+success");
      });
    });
  };

     // login instance
  public login = async (req: Request, res: Response): Promise<void> => {
    if (res.locals.userLogged) res.redirect("/");
    res.render("auth/login", { csrf: req.csrfToken() });
  };

  // Register instance
  public register = async (req: Request, res: Response): Promise<void> => {
    if (res.locals.userLogged) return res.redirect("/");
    res.render("auth/register", { csrf: req.csrfToken() });
  };

  // Login Request
  public loginRequest = async (req: Request, res: Response): Promise<void> => {
    if (res.locals.userLogged) {
      res.redirect("/")
    }
    interface DataClient {
      email: string;
      password: string;
    }
    const dataClient: DataClient = req.body;
    try {
      await this.emailLoginSchema.parseAsync(dataClient.email);
      await this.passwordSchema.parseAsync(dataClient.password);

      const user = await Users.findOne({ raw: true, where: { email: dataClient.email } });
      if (user) {
        const verify: boolean = await password.verify(dataClient.password, user.password, "bcrypt");
        if (verify) {
          const login: boolean = await this.createLogin(req, res, user.id)
          if(login) {
            if (user.otpVerify) {
              res.locals.userLogged = true
              const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress) as string;
              req.session.ip = ip
              res.redirect("/");
            } else {
              res.redirect("/users/otp");
            }
          } else {
            res.redirect("/")
          }
        } else {
          return res.redirect("/users/login?error=Password salah");
        }
      } else {
        return res.redirect("/users/login?error=User tidak ditemukan");
      }
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const errorMessage = this.handleValidationErrors(error);
        return res.redirect("/users/login?error=" + errorMessage);
      } else {
        logger.error("Kesalahan tidak terduga", error);
        return res.redirect("/users/login?error=Kesalahan tidak terduga");
      }
    }
  };

  // Register Request
  public registerRequest = async (req: Request, res: Response): Promise<void> => {
    interface DataClient {
      username: string;
      email: string;
      password: string;
      password2: string;
      bio: string;
    }

    const dataClient: DataClient = req.body;
    try {
      await this.usernameSchema.parseAsync(dataClient.username);
      await this.emailSchema.parseAsync(dataClient.email);
      await this.passwordSchema.parseAsync(dataClient.password);
      await this.passwordSchema.parseAsync(dataClient.password2);
      await this.bioSchema.parseAsync(dataClient.bio);

      if (dataClient.password !== dataClient.password2) {
        return res.redirect("/users/register?error=Password tidak sama");
      }

      const hashedPassword: string = await password.hashSync(dataClient.password, "bcrypt");
      const newUser = await Users.create({
        username: dataClient.username,
        email: dataClient.email,
        password: hashedPassword,
        bio: dataClient.bio,
        is_admin: false,
        otpVerify: false,
      });

      const login: boolean = await this.createLogin(req, res, newUser.dataValues.id)
      if(login) {
        if (newUser.dataValues.otpVerify) {
          res.locals.userLogged = true
          const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress) as string;
          req.session.ip = ip
          res.redirect("/");
        } else {
          res.redirect("/users/otp");
        }
      }
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const errorMessage: string = this.handleValidationErrors(error);
        return res.redirect("/users/register?error=" + errorMessage);
      } else {
        logger.error(error);
        return res.redirect("/users/register?error=Kesalahan tidak terduga");
      }
    }
  };

  // OTP Request
  public otp = async (req: Request, res: Response): Promise<void> => {
    const token: string | undefined = req.session.token
    if (!token) return res.redirect("/");

    try {
      const { otpVerify, email } = jwt.verify(token, process.env.SECRET_JWT_KEY as Secret) as JwtPayload;

      if (otpVerify) return res.redirect("/");

      const mail: Nodemailer = new Nodemailer();
      if(!!!req.session.otp) {
        const otp: string = await mail.sendOtp(email);
        req.session.otp = otp
        req.session.cookie.maxAge = 1 * 60 * 1000
      }
      res.render("auth/otp", { csrf: req.csrfToken(), email });
    } catch (error) {
      logger.error("Error verifying JWT or sending OTP", error);
      return res.redirect("/");
    }
  };

  // OTP Verification
  public otpVerify = async (req: Request, res: Response): Promise<void> => {
    const token: string | undefined = req.session.token
    const otp: string = req.body.otp.join("");
    const email = req.body.email
    if (!token || !otp) return res.redirect("/");

    try {
      const { _id } = jwt.verify(token, process.env.SECRET_JWT_KEY as Secret) as JwtPayload;
      await this.emailLoginSchema.parseAsync(email)
      await this.otpSchema.parseAsync(otp)
      const savedOtp = req.session.otp
      if (otp === savedOtp as string) {
        await Users.update({ otpVerify: true }, { where: { id: _id } });
        const user = await Users.findOne({ where: { id: _id } });

        const login: boolean = await this.createLogin(req, res, user?.id!)
        if(login) {
          const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress) as string;
          req.session.ip = ip
          res.locals.userLogged
          res.redirect("/")
          req.session.otp = ""
        }
      } else {
        return res.redirect("/users/otp?error=OTP yang dimasukkan salah");
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage: string = this.handleValidationErrors(error);
        return res.redirect("/users/otp?error=" + errorMessage);
      } else {
        logger.error("Error verify email", error);
        return res.redirect("/users/otp?error=Kesalahan verifikasi OTP");
      }
    }
  };
  public requestOtp = async (req: Request, res: Response): Promise<void> => {
    const token: string | undefined = req.session.token
    if (!token) return res.redirect("/");
    try {
      const { _id, email } = jwt.verify(token, process.env.SECRET_JWT_KEY as Secret) as JwtPayload;
      const userExist: number = await Users.count({ where: { id: _id } })
      if(userExist === 1) {
        const mail: Nodemailer = new Nodemailer();
        const otp: string = await mail.sendOtp(email);
        req.session.otp = otp
        req.session.cookie.maxAge = 1 * 60 * 1000
        res.json({ success: "OK" })
      } else {
        throw("Auth vailed")
      }
    } catch (error: unknown) {
      logger.error("Error verifying OTP", error)
      res.json({
        error: error
      })
    }
  }
  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    if(res.locals.userLogged) {
      res.render("auth/resetPassword", { csrf: req.csrfToken() })
    } else {
      res.redirect("/")
    }
  }
  public resetPasswordVerify = async (req:Request, res:Response) => {
    interface DataClient {
      otp: string;
      password1: string;
      password2: string;
    }
    if(res.locals.userLogged) {
      try {
        const dataClient: DataClient = req.body
        await this.otpSchema.parseAsync(dataClient.otp)
        await this.passwordSchema.parseAsync(dataClient.password1)
        await this.passwordSchema.parseAsync(dataClient.password2)
        const savedOtp = req.session.otp
        if(dataClient.otp === savedOtp as string) {
          if(dataClient.password1 === dataClient.password2) {
            const jwtDecode = jwt.verify(req.session.token!, process.env.SECRET_JWT_KEY as Secret);
            const { _id, email } = jwtDecode as JwtPayload; 
            await Users.update({
              password: password.hashSync(dataClient.password2, "bcrypt")
            }, { where: { id: _id } })
            res.redirect("/?success=Password berhasil di rubah")
          } else {
            return res.redirect("/users/resetPassword?error=PASSWORD tidak sama");
          }
        } else {
          return res.redirect("/users/resetPassword?error=OTP tidak sesuai");
        }
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          const errorMessage: string = this.handleValidationErrors(error);
          return res.redirect("/users/resetPassword?error=" + errorMessage);
        } else {
          logger.error(error);
          return res.redirect("/users/resetPassword?error=Kesalahan tidak terduga");
        }
      }
    } else {
      res.render("/")
    }
  }
}
