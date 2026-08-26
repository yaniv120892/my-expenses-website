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
    const existingUser = await userRepository.findByEmailOrUsername(
      email,
      username,
    );
    if (existingUser) {
      // Signing up again for an unverified account is a retry, not a conflict —
      // the only way back after an expired code or exhausted attempts. The reply
      // is identical either way because this public, unrated endpoint would
      // otherwise allow unlimited password guessing; the email check is because
      // the lookup also matches username, where a stranger's pending account is
      // a real conflict.
      if (!existingUser.verified && existingUser.email === email) {
        if (await compare(password, existingUser.password)) {
          return this.issueVerificationCode(existingUser.email);
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
    // Nothing that shipped before this account existed is "new" to it.
    await announcementService.acknowledgeAllForNewUser(user.id);
    return this.issueVerificationCode(email);
  }

  private async issueVerificationCode(email: string) {
    const code = this.generateCode();
    await setValue(loginCodeKey(email), code, 600);
    await deleteValue(loginCodeAttemptsKey(email));
    await this.sendCodeByEmail(email, code);
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
    // A 6-digit code valid for 10 minutes is brute-forceable without an
    // attempt cap. The cap locks the code for the counter's window rather than
    // deleting it: /api/auth/verify is public, so burning the code here would
    // let anyone who knows a pending signup's address strand that account.
    const attemptsKey = loginCodeAttemptsKey(email);
    const attempts = await incrementWithTtl(attemptsKey, 600);
    if (attempts > MAX_CODE_ATTEMPTS) {
      return { error: 'Too many attempts. Please request a new code.' };
    }

    const cachedCode = await getValue<string>(loginCodeKey(email));
    if (!cachedCode || !this.safeCodeCompare(String(cachedCode), code)) {
      return { error: 'Invalid or expired code' };
    }
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { error: 'User not found' };
    }
    await userRepository.verifyUser(email);
    const token = await signToken(user.id);
    await deleteValue(loginCodeKey(email));
    await deleteValue(attemptsKey);
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

  private safeCodeCompare(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    return (
      expectedBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    );
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
