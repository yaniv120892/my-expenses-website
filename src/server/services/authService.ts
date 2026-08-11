import { hash, compare } from 'bcryptjs';
import crypto from 'crypto';
import { setValue, getValue, deleteValue } from '@/server/redis';
import {
  invalidateSession,
  isSessionActive,
  storeSession,
} from '@/server/auth/session';
import { signToken, tokenTtlSeconds, verifyToken } from '@/server/auth/tokens';
import userRepository from '@/server/repositories/userRepository';
import emailService from '@/server/services/emailService';
import announcementService from '@/server/services/announcementService';

class AuthService {
  public async signupUser(email: string, username: string, password: string) {
    const existingUser = await userRepository.findByEmailOrUsername(
      email,
      username,
    );
    if (existingUser) {
      return { error: 'User already exists' };
    }
    const hashedPassword = await hash(password, 10);
    const user = await userRepository.createUser(
      email,
      username,
      hashedPassword,
    );
    // Nothing that shipped before this account existed is "new" to it.
    await announcementService.acknowledgeAllForNewUser(user.id);
    const code = this.generateCode();
    await setValue(`loginCode:${email}`, code, 600);
    await this.sendCodeByEmail(email, code);
    return {
      message: 'Verification code sent to email. Code is valid for 10 minutes.',
    };
  }

  public async loginUser(email: string, username: string, password: string) {
    const user = await userRepository.findByEmailOrUsername(email, username);
    if (!user) {
      return { error: 'Invalid credentials' };
    }
    const valid = await compare(password, user.password);
    if (!valid) {
      return { error: 'Invalid credentials' };
    }
    if (user.verified === false) {
      return { error: 'User not verified' };
    }
    const token = await signToken(user.id);
    await storeSession(user.id, token, tokenTtlSeconds());
    return { token };
  }

  public async verifyLoginCode(email: string, code: string) {
    const cachedCode = await getValue<string>(`loginCode:${email}`);
    if (!cachedCode || String(cachedCode) !== code) {
      return { error: 'Invalid or expired code' };
    }
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { error: 'User not found' };
    }
    await userRepository.verifyUser(email);
    const token = await signToken(user.id);
    await deleteValue(`loginCode:${email}`);
    await storeSession(user.id, token, tokenTtlSeconds());
    return { token };
  }

  public async logoutUser(userId: string, token: string) {
    await invalidateSession(userId, token);
  }

  public async validateSession(
    userId: string,
    token: string,
  ): Promise<boolean> {
    if (!(await isSessionActive(userId, token))) {
      return false;
    }
    try {
      await verifyToken(token);
      return true;
    } catch {
      return false;
    }
  }

  private generateCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  private generateVerificationEmailText(code: string, email: string) {
    const websiteUrl = process.env.WEBSITE_URL;
    return [
      'Hello,',
      '',
      'Thank you for signing up. To complete your registration, please use the verification code below:',
      '',
      `Verification Code: ${code}`,
      '',
      'You can copy the code above and paste it into the verification page.',
      '',
      'This code will expire in 10 minutes. For your security, do not share this code with anyone.',
      '',
      'If you did not request this code, you can safely ignore this email.',
      '',
      `To verify your email address, visit: ${websiteUrl}/verify?email=${email}`,
      '',
      'Best regards,',
      'The My Expenses Team',
    ].join('\n');
  }

  private generateVerificationEmailHtml(code: string, email: string) {
    const websiteUrl = process.env.WEBSITE_URL;
    return `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 480px; margin: 0 auto;">
        <p>Hello,</p>
        <p>Thank you for signing up. To complete your registration, please use the verification code below:</p>
        <div style="margin: 24px 0;">
          <span style="display: inline-block; font-size: 1.5em; letter-spacing: 0.2em; background: #f4f4f4; padding: 16px 32px; border-radius: 8px; font-weight: bold; user-select: all;">${code}</span>
        </div>
        <p>You can copy the code above and paste it into the verification page.</p>
        <p>This code will expire in 10 minutes. For your security, do not share this code with anyone.</p>
        <p>If you did not request this code, you can safely ignore this email.</p>
        <p>To verify your email address, visit: <a href="${websiteUrl}/verify?email=${email}">${websiteUrl}/verify?email=${email}</a></p>
        <p style="margin-top: 32px;">Best regards,<br>The My Expenses Team</p>
      </div>
    `;
  }

  private async sendCodeByEmail(email: string, code: string) {
    await emailService.send({
      to: email,
      subject: 'Your Verification Code',
      text: this.generateVerificationEmailText(code, email),
      html: this.generateVerificationEmailHtml(code, email),
    });
  }
}

export default new AuthService();
