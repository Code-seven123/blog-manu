declare namespace NodeJS {
  interface ProcessEnv {
    DB_DRIVER: string;
    DB_HOST: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_NAME: string;
    DB_FILE: string;
    PORT: number;
    SESSION_KEY: string;
    SECRET_JWT_KEY: string;
  }
}
