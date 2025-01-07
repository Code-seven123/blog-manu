import { sequelize, Blogs, Users } from '../database'; // Impor model Blog Anda
import { faker }  from '@faker-js/faker';
import { describe, it, expect, beforeAll, afterAll  } from 'bun:test';
// Fungsi untuk membuat 24 blog
async function createBlogs(id: number) {
  const blogs = [];

  for (let i = 0; i < 24; i++) {
    blogs.push({
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(3),
      image: faker.image.urlPicsumPhotos(),
      userId: id,
    });
  }

  return Blogs.bulkCreate(blogs);
}
describe('Blog Creation Tests', () => {
  let userId: number;

  beforeAll(async () => {
    // Menghubungkan ke database
    await sequelize.authenticate();
    await sequelize.sync({ force: true }); // Sinkronkan dan buat ulang tabel

    // Membuat user untuk testing
    const user = await Users.create({
      username: "johndoe",
      email: "john.doe@example.com",
      password: "password123",
      is_admin: true,
      bio: "hello"
    });

    userId = user.userId;
  });

  // afterAll(async () => {
  //   // Menutup koneksi setelah tes selesai
  //   await sequelize.close();
  // });

  it('should create 24 blogs', async () => {
    // Memanggil fungsi untuk membuat 24 blog
    await createBlogs(userId);

    // Memastikan 24 blog berhasil dibuat
    const blogs = await Blogs.findAll();
    expect(blogs.length).toBe(24);

    // Memastikan data blog pertama
    expect(blogs[0].title).toBeTruthy();
    expect(blogs[0].content).toBeTruthy();
    expect(blogs[0].image).toBeTruthy();
    expect(blogs[0].userId).toBe(userId);
  });
});