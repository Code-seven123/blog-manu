import nodemailer from 'nodemailer';
import { describe, it, expect } from 'bun:test';
import { logger } from '../src/winston-log';

async function createTestAccount() {
  try {
    const testAccount = await nodemailer.createTestAccount();
    return testAccount;
  } catch (error: unknown) {
    throw new Error('Failed to create test account: ' + error);
  }
}

describe('Mailer Tests', () => {
  it('should create a test account with Nodemailer', async () => {
    const testAccount = await createTestAccount();
    logger.info("Account test:", testAccount)
    // Pastikan akun pengujian berhasil dibuat
    expect(testAccount).toHaveProperty('user');
    expect(testAccount).toHaveProperty('pass');
    expect(testAccount.user).toMatch(/.*@.*\..+/);  // Memastikan bahwa user adalah email
    expect(testAccount.pass).toBeTruthy();  // Pastikan password tersedia
  });
});
