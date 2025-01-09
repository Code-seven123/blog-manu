import * as session from "express-session";
declare module "express-session" {
  interface SessionData {
    user?: { status?: boolean = false; token?: string };
    csrfToken?: string;
    otp?: string;
  }
}