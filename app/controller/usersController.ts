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
    .min(4, { message: "Username harus lebih dari 4 kata." })
    .max(100, { message: "Username tidak boleh lebih dari 100 kata" })
    .refine(async (value: string) => {
      const user = await Users.count({ where: { username: value } });
      return user === 0;
    }, { message: "Username sudah ada" });

  private bioSchema = z
    .string()
    .max(200, { message: "Bio tidak boleh lebih dari 200 kata" })
    .optional();

  private emailSchema = z
    .string()
    .email({ message: "Email tidak valid." })
    .max(255, { message: "Email tidak boleh lebih dari 255 kata" })
    .refine(async (value: string) => {
      const user = await Users.count({ where: { email: value } });
      return user === 0;
    }, { message: "Email sudah ada" });

  private emailLoginSchema = z
    .string()
    .email({ message: "Email tidak valid." })
    .max(255, { message: "Email tidak boleh lebih dari 255 kata" });

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

  private handleValidationErrors = (error: ZodError): string => {
    // Memastikan bahwa error adalah ZodError yang valid
    if (!error.errors || !Array.isArray(error.errors)) {
      return "Unknown validation error";
    }

    // Mengambil pesan kesalahan dari setiap masalah validasi dan menggabungkannya dengan koma
    return error.errors
      .map((err: ZodIssue) => {
        // Pastikan pesan validasi ada sebelum mengaksesnya
        return err.message || "Unknown error";
      })
      .join(", ");
  };

  // logout instance
  public logout = async (req: Request, res: Response): Promise<void> => {
    req.session.destroy((err: Error | null) => {
      if (err) {
        logger.error("/logout \nCode: 500 \nMessage: Failed to destroy session");
        return res.status(500).send('Failed to destroy session');
      }
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  };

  // login instance
  public login = async (req: Request, res: Response): Promise<void> => {
    if (res.locals.userLogged) res.redirect("/");
    res.render("auth/login", { csrf: req.csrfToken() });
  };

  public loginRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (res.locals.userLogged) res.redirect("/");
    interface DataClient {
      email: string;
      password: string;
    }
    const dataClient: DataClient = req.body;
    try {
      await this.emailLoginSchema.parseAsync(dataClient.email);
      await this.passwordSchema.parseAsync(dataClient.password);

      const user = await Users.findOne({ where: { email: dataClient.email } });
      if (user) {
        const verify: boolean = await password.verifySync(dataClient.password, user.password, "bcrypt");
        if (verify) {
          const jwtSession: string = jwt.sign({
            _id: user.userId,
            email: user.email,
            name: user.username,
            otpVerify: user.otpVerify
          }, process.env.SECRET_JWT_KEY as Secret, {
            expiresIn: "2 days"
          });

          req.session.user = { status: true, token: jwtSession };
          res.cookie("login", req.sessionID, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000
          });

          if (user.otpVerify) {
            res.locals.userVerify = true;
            res.redirect("/");
          } else {
            res.locals.userVerify = false;
            res.redirect("/users/otp");
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
        logger.error(error);
        return res.redirect("/users/login?error=Kesalahan tidak terduga");
      }
    }
  };

  // Register instance
  public register = async (req: Request, res: Response): Promise<void> => {
    if (res.locals.userLogged) return res.redirect("/");
    res.render("auth/register", { csrf: req.csrfToken() });
  };

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
      await this.usernameSchema.parseAsync(dataClient.username);
      await this.emailSchema.parseAsync(dataClient.email);
      await this.passwordSchema.parseAsync(dataClient.password);
      await this.passwordSchema.parseAsync(dataClient.password2);
      await this.bioSchema.parseAsync(dataClient.bio);

      // Periksa apakah password dan password2 cocok
      if (dataClient.password !== dataClient.password2) {
        return res.redirect("/users/register?error=Password tidak sama");
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
        otpVerify: false
      });

      // Membuat JWT session
      const jwtSession: string = jwt.sign({
        _id: newUser.dataValues.userId,
        email: newUser.dataValues.email,
        name: newUser.dataValues.username,
        otpVerify: false
      }, process.env.SECRET_JWT_KEY as Secret, { expiresIn: "2 days" });

      req.session.user = { status: true, token: jwtSession };
      res.locals.userLogged = true;
      res.locals.userVerify = false;
      res.cookie("login", req.sessionID, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.redirect("/users/otp");

    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const errorMessage = this.handleValidationErrors(error);
        return res.redirect("/users/register?error=" + errorMessage);
      } else {
        logger.error(error);
        return res.redirect("/users/register?error=Kesalahan tidak terduga");
      }
    }
  };

  public otp = async (req: Request, res: Response): Promise<void> => {
    if (req.session.user?.status === false || !req.session.user?.token) {
      return res.redirect("/");
    }

    try {
      const jwtSession: any = req.session.user;
      const jwtDecode = jwt.verify(jwtSession.token!, process.env.SECRET_JWT_KEY as Secret);
      const { otpVerify, email } = jwtDecode as JwtPayload;

      if (otpVerify) {
        return res.redirect("/");
      }

      const mail = new Nodemailer();
      const otp = await mail.sendOtp(email);
      req.session.otp = otp;

      res.render("auth/otp", { csrf: req.csrfToken(), email });

    } catch (error) {
      logger.error("Error verifying JWT or sending OTP", error);
      return res.redirect("/");
    }
  };

  public otpVerify = async (req: Request, res: Response): Promise<void> => {
    if (req.session.user?.status === false || !req.session.user?.token || !req.session.otp) {
      return res.redirect("/");
    }
    try {
      const otps = req.body.otp;
      const jwtSession: any = req.session.user;
      const jwtDecode = jwt.verify(jwtSession.token!, process.env.SECRET_JWT_KEY as Secret);
      const { otpVerify, _id } = jwtDecode as JwtPayload;

      if (otpVerify) {
        return res.redirect("/");
      }

      const otp = otps.join("");
      if (otp === req.session.otp) {
        await Users.update({ otpVerify: true }, { where: { userId: _id } });
        const user = await Users.findOne({ where: { userId: _id } });

        const jwtSession: string = jwt.sign({
          _id: user?.userId,
          email: user?.email,
          name: user?.username,
          otpVerify: true
        }, process.env.SECRET_JWT_KEY as Secret, { expiresIn: "30 days" });

        req.session.user = { status: true, token: jwtSession };
        res.locals.userVerify = true;

        res.redirect("/");
      } else {
        return res.redirect("/users/otp?error=OTP yang dimasukkan salah");
      }
    } catch (error) {
      logger.error("Error verifying OTP", error);
      return res.redirect("/users/otp?error=Kesalahan verifikasi OTP");
    }
  };
}
