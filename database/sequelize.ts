import { Sequelize } from "sequelize-typescript";
import { logger } from "../src/winston-log"
import { Users } from "./models/User";
import { Blog }  from "./models/Blog";

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: msg => logger.debug(msg),
  models: [Users, Blog]
});

async function syncDatabase() {
  try {
    await sequelize.sync({ force: true });
    logger.info('Database synchronized');
  } catch (error) {
    logger.error('Error syncing database:', error);
  }
}

syncDatabase();