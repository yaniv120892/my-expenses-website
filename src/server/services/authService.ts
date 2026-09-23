import { hash, compare } from 'bcryptjs';
import crypto from 'crypto';
import {
  setValue,
  getValue,
  deleteValue,
  incrementWithTtl,
} from '@/server/redis';
import {
  invalidateSession,
  isSessionActive,
  storeSession,
} from '@/server/auth/session';
import { signToken, tokenTtlSeconds, verifyToken } from '@/server/auth/tokens';
import userRepository from '@/server/repositories/userRepository';
import emailService from '@/server/services/emailService';
import announcementService from '@/server/services/announcementService';
import { requireSiteUrl } from '@/server/env';
import { secretsEqual } from '@/server/utils/webhookAuth';

const MAX_CODE_ATTEMPTS = 5;
const VERIFICATION_CODE_SENT =
  'Verification code sent to email. Code is valid for 10 minutes.';

function loginCodeKey(email: string): string {
  return `loginCode:${email}`;
}

function loginCodeAttemptsKey(email: string): string {
  return `loginCodeAttempts:${email}`;
}

class AuthService {
  public async signupUser(email: string, username: string, password: string) {
    // Before any write: throwing after createUser would leave an unverified
    // account the retry path cannot rescue.
    const websiteUrl = requireSiteUrl();
    const existingUser = await userRepository.findByEmailOrUsername(
      email,
      username,
    );
    if (existingUser) {
      // A retry of an unverified signup, not a conflict, answered identically
      // so this public endpoint allows no password guessing. The email check is
      // because the lookup also matches username.
      if (!existingUser.verified && existingUser.email === email) {
        if (await compare(password, existingUser.password)) {
          return this.issueVerificationCode(existingUser.email, websiteUrl);
        }
        return { message: VERIFICATION_CODE_SENT };
      }
      return { error: 'User already exists' };
    }
    const hashedPassword = await hash(password, 10);
    const user = await userRepository.createUser(
      email,
      username,
      hashedPassword,
    );
    await announcementService.acknowledgeAllForNewUser(user.id);
    return this.issueVerificationCode(email, websiteUrl);
  }

  private async issueVerificationCode(email: string, websiteUrl: string) {
    const code = this.generateCode();
    await setValue(loginCodeKey(email), code, 600, 'branch');
    await deleteValue(loginCodeAttemptsKey(email), 'branch');
    await this.sendCodeByEmail(email, code, websiteUrl);
    return { message: VERIFICATION_CODE_SENT };
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
    // The cap locks the code for the counter's window rather than deleting it:
    // /api/auth/verify is public, so burning the code would let anyone strand a
    // pending signup.
    const attemptsKey = loginCodeAttemptsKey(email);
    const attempts = await incrementWithTtl(attemptsKey, 600, 'branch');
    if (attempts > MAX_CODE_ATTEMPTS) {
      return { error: 'Too many attempts. Please request a new code.' };
    }

    const cachedCode = await getValue<string>(loginCodeKey(email), 'branch');
    if (!cachedCode || !secretsEqual(code, String(cachedCode))) {
      return { error: 'Invalid or expired code' };
    }
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { error: 'User not found' };
    }
    await userRepository.verifyUser(email);
    const token = await signToken(user.id);
    await deleteValue(loginCodeKey(email), 'branch');
    await deleteValue(attemptsKey, 'branch');
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

  private generateVerificationEmailText(
    code: string,
    email: string,
    websiteUrl: string,
  ) {
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
      `To verify your email address, visit: ${this.verificationUrl(websiteUrl, email)}`,
      '',
      'Best regards,',
      'The My Expenses Team',
    ].join('\n');
  }

  private generateVerificationEmailHtml(
    code: string,
    email: string,
    websiteUrl: string,
  ) {
    const verificationUrl = this.verificationUrl(websiteUrl, email);
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
        <p>To verify your email address, visit: <a href="${verificationUrl}">${verificationUrl}</a></p>
        <p style="margin-top: 32px;">Best regards,<br>The My Expenses Team</p>
      </div>
    `;
  }

  private verificationUrl(websiteUrl: string, email: string): string {
    return `${websiteUrl}/verify?email=${encodeURIComponent(email)}`;
  }

  private async sendCodeByEmail(
    email: string,
    code: string,
    websiteUrl: string,
  ) {
    await emailService.send({
      to: email,
      subject: 'Your Verification Code',
      text: this.generateVerificationEmailText(code, email, websiteUrl),
      html: this.generateVerificationEmailHtml(code, email, websiteUrl),
    });
  }
}

export default new AuthService();
