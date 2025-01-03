import "reflect-metadata"
import { sequelize } from "./database/sequelize"
import { Users } from "./database/models/User"

const admin = await Users.findOne({
  where: {
    is_admin: true
  }
})



console.log(admin)