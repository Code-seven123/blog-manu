import { Secret } from "jsonwebtoken";

declare namespace NodeJS {
  interface ProcessEnv {
    DB_DRIVER: string;
    DB_HOST: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_NAME: string;
    DB_FILE: string;
    PORT: number;
    SECRET_JWT_KEY: string;
    SECRET_COOKIE_KEY: string;
    SECRET_SESSION_KEY: string;
    EMAIL_NAME: string;
    EMAIL_PASSWORD: string;
    EMAIL_HOST: string;
    EMAIL_PORT: number;
    EMAIL_SECURE: boolean;
    COOKIE_SECURE: boolean;
  }
}
