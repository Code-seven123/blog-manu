import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Users } from "./User";

@Table
export class Blog extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true
  })
  declare blogId: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false
  })
  declare title: string;
  
  @Column({
    type: DataType.TEXT,
    allowNull: false
  })
  declare content: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare publishedAt: Date;
  
  @ForeignKey(() => Users)
  @Column({
    type: DataType.NUMBER,
    allowNull: false,
  })
  userId!: number

  @BelongsTo(() => Users)
  user!: Users
  
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