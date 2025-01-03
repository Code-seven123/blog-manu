import { Column, DataType, HasMany, Model, Table } from "sequelize-typescript";
import { Blog } from "./Blog";

@Table
export class Users extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare userId: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true,
  })
  declare username: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare password: string;

  @Column({
    type: DataType.STRING(200),
    allowNull:  true
  })
  declare description: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false
  })
  declare is_admin: boolean;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare updatedAt: Date;

  
}