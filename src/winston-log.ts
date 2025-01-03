import winston from "winston";
import { Console, File } from "winston/lib/winston/transports";

export const logger = winston.createLogger({
  level: "debug",
  format: winston.format.colorize(),
  transports: [
    new Console({
      level: "info",
      format: winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.simple())
    }),
    new File({ 
      level: "error",
      filename: "../log/error.log",
      format: winston.format.combine(winston.format.timestamp(), winston.format.json())
    }),
    new File({ 
      level: "fatal",
      filename: "../log/fatal.log",
      format: winston.format.combine(winston.format.timestamp(), winston.format.json())
    }),
    new File({ 
      level: "warn",
      filename: "../log/warn.log",
      format: winston.format.combine(winston.format.timestamp(), winston.format.json())
    })
  ]
})