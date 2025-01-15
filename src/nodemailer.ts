import nodemailer, { Transport, TransportOptions } from "nodemailer"
import { logger } from "./winston-log";
import optGenerator from "otp-generator"


export default class Nodemailer {
  private transporter = async () => {
    const isDevelopment = process.env.NODE_ENV === "development"
    const account = isDevelopment ? await nodemailer.createTestAccount() : null
    return nodemailer.createTransport({
      host: isDevelopment ? account?.smtp.host :  process.env.EMAIL_HOST,
      port: isDevelopment ? account?.smtp.port :  process.env.EMAIL_PORT,
      secure: isDevelopment ? account?.smtp.secure :  process.env.EMAIL_SECURE, // true untuk port 465, false untuk port 587
      auth: {
        user: isDevelopment ? account?.user :  process.env.EMAIL_NAME,
        pass: isDevelopment ? account?.pass :  process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: isDevelopment ? true : false  // Menjamin bahwa server menggunakan sertifikat yang valid
      },
      logger: true
    });
  }
  public sendOtp: Function = async (email:string) => {
    const otp = optGenerator.generate(6, {
      digits: true,
      upperCaseAlphabets: true,
      specialChars: false
    })
    const mailOptions = {
      from: process.env.EMAIL_NAME,
      to: email, 
      subject: otp, // Subjek email
      text: `Your OTP code is: ${otp}`, // Isi email dalam format teks (untuk email client yang tidak mendukung HTML)
      html: `
        <h2>Your OTP Code</h2>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this code, please ignore this email.</p>
        <footer>
          <p>Best regards,</p>
          <p>manu blog</p>
        </footer>
      `, // Isi email dalam format HTML
    };
    const transporter = await this.transporter()
    transporter.verify((error, success) => {
      if (error) {
        logger.error("SMTP connection error:", error);
      } else {
        logger.info("SMTP connection verified:", success);
      }
    });
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return logger.error('Error saat mengirim email:', error);
      }
      logger.info('Email sent: ', info.messageId);
      if(process.env.NODE_ENV === "development") {
        logger.info('Preview URL: ' + nodemailer.getTestMessageUrl(info))
      }
    });
    return otp
  }
}