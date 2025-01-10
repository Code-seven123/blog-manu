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

  private handleValidationErrors = (error: ZodError): string => {
    if (!error.errors || !Array.isArray(error.errors)) {
      return "Unknown validation error";
    }
    return error.errors
      .map((err: ZodIssue) => err.message || "Unknown error")
      .join(", ");
  };

    // logout instance
    public logout = async (req: Request, res: Response): Promise<void> => {
      res.clearCookie("token");
      res.redirect("/");
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
        const verify = await password.verifySync(dataClient.password, user.password, "bcrypt");
        if (verify) {
          const jwtSession = jwt.sign({
            _id: user.userId,
            email: user.email,
            name: user.username,
            otpVerify: user.otpVerify as boolean,
          }, process.env.SECRET_JWT_KEY as Secret, { expiresIn: "2 days" });

          res.cookie('token', jwtSession, {
            httpOnly: true,
            maxAge: 7*24*60*60*1000,
            secure: process.env.COOKIE_SECURE === "true",
            sameSite: "strict"
          });
          if (user.otpVerify) {
            res.redirect("/");
          } else {
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

      const hashedPassword = await password.hashSync(dataClient.password, "bcrypt");
      const newUser = await Users.create({
        username: dataClient.username,
        email: dataClient.email,
        password: hashedPassword,
        bio: dataClient.bio,
        is_admin: false,
        otpVerify: false,
      });

      const jwtSession = jwt.sign({
        _id: newUser.dataValues.userId,
        email: newUser.dataValues.email,
        name: newUser.dataValues.username,
        otpVerify: false,
      }, process.env.SECRET_JWT_KEY as Secret, { expiresIn: "2 days" });

      res.cookie('token', jwtSession, {
        httpOnly: true,
        maxAge: 7*24*60*60*1000,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: "strict"
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

  // OTP Request
  public otp = async (req: Request, res: Response): Promise<void> => {
    const token = req.cookies.token
    if (!token) return res.redirect("/");

    try {
      const jwtDecode = jwt.verify(token, process.env.SECRET_JWT_KEY as Secret);
      const { otpVerify, email } = jwtDecode as JwtPayload;

      if (otpVerify) return res.redirect("/");

      const mail = new Nodemailer();
      const otp = await mail.sendOtp(email);
      res.setHeader("X-OTP", otp);

      res.render("auth/otp", { csrf: req.csrfToken(), email });
    } catch (error) {
      logger.error("Error verifying JWT or sending OTP", error);
      return res.redirect("/");
    }
  };

  // OTP Verification
  public otpVerify = async (req: Request, res: Response): Promise<void> => {
    const token = req.cookies.token
    const otp = req.body.otp.join("");

    if (!token || !otp) return res.redirect("/");

    try {
      const jwtDecode = jwt.verify(token, process.env.SECRET_JWT_KEY as Secret);
      const { _id } = jwtDecode as JwtPayload;

      const savedOtp = req.headers["x-otp"];
      if (otp === savedOtp) {
        await Users.update({ otpVerify: true }, { where: { userId: _id } });
        const user = await Users.findOne({ where: { userId: _id } });

        const newToken = jwt.sign({
          _id: user?.userId,
          email: user?.email,
          name: user?.username,
          otpVerify: true,
        }, process.env.SECRET_JWT_KEY as Secret, { expiresIn: "30 days" });

        res.setHeader("Authorization", `Bearer ${newToken}`);
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
