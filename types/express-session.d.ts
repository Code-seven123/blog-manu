import * as session from "express-session";
import { IpVersion } from "zod";
declare module "express-session" {
  interface SessionData {
    token?: string;
    otp?: string;
    ip?: string = '';
  }
}