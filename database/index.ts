import {
  Sequelize,
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Dialect,
} from "sequelize";
import { logger } from "../src/winston-log";
export const sequelize: Sequelize = new Sequelize(/* process?.env?.DB_NAME ?? '', process?.env?.DB_USER ?? '', process?.env?.DB_PASSWORD ?? '', */{
  //host: process?.env?.DB_HOST ?? '',
  dialect: process.env.DB_DRIVER as Dialect || 'mysql',
  storage: "./database/database.sqlite",
  logging: msg => logger.debug(msg)
});
await sequelize.authenticate()
  .then(() => {
    logger.info('Connection to the database has been established successfully.');
  })
  .catch(err => {
    logger.error('Unable to connect to the database:', err);
  });

export class Users extends Model<InferAttributes<Users>, InferCreationAttributes<Users>> {
  declare userId: CreationOptional<number>;
  declare username: string;
  declare email: string;
  declare bio: string;
  declare password: string;
  declare otpVerify: boolean;
  declare is_admin: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
export class Blogs extends Model<InferAttributes<Blogs>, InferCreationAttributes<Blogs>> {
  declare blogId: CreationOptional<number>;
  declare title: string;
  declare content: string;
  declare image: string;
  declare userId: ForeignKey<Users["userId"]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Users.init({
  userId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  bio: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  password: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  otpVerify: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  createdAt: {
    type: DataTypes.DATE,
  },
  updatedAt: {
    type: DataTypes.DATE,
  }
}, { sequelize, tableName: "users" })
Blogs.init({
  blogId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER
  },
  createdAt: {
    type: DataTypes.DATE,
  },
  updatedAt: {
    type: DataTypes.DATE,
  }
}, { sequelize, tableName: "blogs" })

Users.hasMany(Blogs, {
  sourceKey: "userId",
  foreignKey: "userId",
  as: "blogs"
})
Blogs.belongsTo(Users, { targetKey: "userId" })

const opt: object = process.env.NODE_ENV == "development" ? { force: true } : { alter: true }
await sequelize.sync(opt)
  .then(() => {
    logger.info('Database synchronized.');
  })
  .catch((error) => {
    logger.error('Error syncing database:', error);
  });