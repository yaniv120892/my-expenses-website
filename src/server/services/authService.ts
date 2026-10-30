import { hash, compare } from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { setValue, getValue, deleteValue, incrementWithTtl, takeValue } from '@/server/redis';
import { invalidateAllSessions, invalidateSession, storeSession } from '@/server/auth/session';
import { signToken, tokenTtlSeconds } from '@/server/auth/tokens';
import userRepository from '@/server/repositories/userRepository';
import emailService from '@/server/services/emailService';
import announcementService from '@/server/services/announcementService';
import { requireSiteUrl } from '@/server/env';
import { secretsEqual } from '@/server/utils/webhookAuth';

const MAX_CODE_ATTEMPTS = 5;
const CODE_TTL_SECONDS = 600;
// Each signup gets its own code, so one stranger's signup does not void the code
// the owner was mailed; capped because every live code shares one attempts
// counter.
const MAX_PENDING_CODES = 3;
// Not a bcrypt hash, so compare() never matches it: a pending account has no
// password until a code is verified.
const UNUSABLE_PASSWORD = '!unverified';
const VERIFICATION_CODE_SENT = 'Verification code sent to email. Code is valid for 10 minutes.';
const BCRYPT_ROUNDS = 10;
const PASSWORD_RESET_TTL_SECONDS = 1800;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const INVALID_RESET_LINK = 'This reset link is invalid or has expired. Please request a new one.';

function loginCodeKey(email: string): string {
  return `loginCode:${email}`;
}

function loginCodeAttemptsKey(email: string): string {
  return `loginCodeAttempts:${email}`;
}

// Keyed by the token's hash, so reading Redis does not yield a usable link.
function passwordResetKey(tokenHash: string): string {
  return `passwordReset:${tokenHash}`;
}

function latestPasswordResetKey(userId: string): string {
  return `passwordResetFor:${userId}`;
}

// A code proves only that its holder reads the mailbox, so it carries no
// password. Codes stored before carried the requesting signup's password hash,
// which this parse drops.
const pendingCodeSchema = z.object({
  code: z.string(),
  expiresAt: z.number(),
});
type PendingCode = z.infer<typeof pendingCodeSchema>;
const storedCodesSchema = z.array(pendingCodeSchema);

class AuthService {
  // Takes no password: anyone can send a signup for someone else's address, so
  // nothing a signup names may decide the account's password. It is chosen at
  // verification, by whoever holds a mailed code.
  public async signupUser(email: string, username: string) {
    // Before any write: throwing after createUser would leave an unverified
    // account the retry path cannot rescue.
    const websiteUrl = requireSiteUrl();
    const existingUser = await userRepository.findByEmailOrUsername(email, username);
    if (existingUser) {
      // The email check is because the lookup also matches username.
      const isPendingSignupForThisEmail = !existingUser.verified && existingUser.email === email;
      if (isPendingSignupForThisEmail) {
        return this.issueVerificationCode(existingUser.email, websiteUrl);
      }
      return { error: 'User already exists' };
    }
    const user = await userRepository.createUser(email, username, UNUSABLE_PASSWORD);
    await announcementService.acknowledgeAllForNewUser(user.id);
    return this.issueVerificationCode(email, websiteUrl);
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
    return { token, userId: user.id };
  }

  public async verifyLoginCode(email: string, code: string, password: string) {
    // The cap locks the code for the counter's window rather than deleting it:
    // /api/auth/verify is public, so burning the code would let anyone strand a
    // pending signup.
    const attemptsKey = loginCodeAttemptsKey(email);
    const attempts = await incrementWithTtl(attemptsKey, CODE_TTL_SECONDS, 'branch');
    if (attempts > MAX_CODE_ATTEMPTS) {
      return { error: 'Too many attempts. Please try again in 10 minutes.' };
    }

    const matchedCode = (await this.readPendingCodes(email)).find((pending) =>
      secretsEqual(code, pending.code),
    );
    if (!matchedCode) {
      return { error: 'Invalid or expired code' };
    }
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { error: 'User not found' };
    }
    // A signup racing the owner's verify can store a code after it; that code
    // must never reset a verified account's password.
    if (user.verified) {
      await deleteValue(loginCodeKey(email), 'branch');
      return { error: 'Invalid or expired code' };
    }
    await userRepository.verifyUser(email, await hash(password, BCRYPT_ROUNDS));
    const token = await signToken(user.id);
    await deleteValue(loginCodeKey(email), 'branch');
    await deleteValue(attemptsKey, 'branch');
    await storeSession(user.id, token, tokenTtlSeconds());
    return { token, userId: user.id };
  }

  public async logoutUser(userId: string, token: string) {
    await invalidateSession(userId, token);
  }

  // Returns nothing either way, so no response can tell a registered address
  // from an unknown one.
  public async requestPasswordReset(email: string): Promise<void> {
    const websiteUrl = requireSiteUrl();
    const user = await userRepository.findByEmail(email);
    if (!user?.verified) {
      return;
    }
    const token = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hashResetToken(token);
    // Only the latest link works, so an older mail left in an inbox is dead.
    await this.revokePasswordReset(user.id);
    await setValue(passwordResetKey(tokenHash), user.id, PASSWORD_RESET_TTL_SECONDS, 'branch');
    await setValue(
      latestPasswordResetKey(user.id),
      tokenHash,
      PASSWORD_RESET_TTL_SECONDS,
      'branch',
    );
    const resetUrl = this.passwordResetUrl(websiteUrl, token);
    await emailService.send({
      to: email,
      subject: 'Reset your password',
      text: this.generatePasswordResetEmailText(resetUrl),
      html: this.generatePasswordResetEmailHtml(resetUrl),
    });
  }

  public async resetPassword(token: string, newPassword: string) {
    // GETDEL, so of two submits of one link only the first finds a user.
    const userId = await takeValue<string>(passwordResetKey(this.hashResetToken(token)), 'branch');
    if (!userId) {
      return { error: INVALID_RESET_LINK };
    }
    await deleteValue(latestPasswordResetKey(userId), 'branch');
    await this.replacePassword(userId, newPassword);
    return { userId };
  }

  public async changePassword({
    userId,
    currentPassword,
    newPassword,
  }: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const user = await userRepository.findById(userId);
    const currentPasswordMatches = !!user && (await compare(currentPassword, user.password));
    if (!currentPasswordMatches) {
      return { error: 'Current password is incorrect' };
    }
    await this.replacePassword(userId, newPassword);
    await this.revokePasswordReset(userId);
    const token = await signToken(userId);
    await storeSession(userId, token, tokenTtlSeconds());
    return { token, userId };
  }

  private async issueVerificationCode(email: string, websiteUrl: string) {
    const code = this.generateCode();
    const pendingCode: PendingCode = {
      code,
      expiresAt: Date.now() + CODE_TTL_SECONDS * 1000,
    };
    const liveCodes = await this.readPendingCodes(email);
    await setValue(
      loginCodeKey(email),
      [...liveCodes, pendingCode].slice(-MAX_PENDING_CODES),
      CODE_TTL_SECONDS,
      'branch',
    );
    // The attempts counter is left alone: anyone can sign up for a pending
    // address, so a reset here would let a guesser lift its own cap.
    await this.sendCodeByEmail(email, code, websiteUrl);
    return { message: VERIFICATION_CODE_SENT };
  }

  // Every session ends, the caller's included: a password is changed or reset
  // because someone else may know the old one.
  private async replacePassword(userId: string, newPassword: string): Promise<void> {
    await userRepository.updatePassword(userId, await hash(newPassword, BCRYPT_ROUNDS));
    await invalidateAllSessions(userId);
  }

  private async revokePasswordReset(userId: string): Promise<void> {
    const previousTokenHash = await getValue<string>(latestPasswordResetKey(userId), 'branch');
    if (previousTokenHash) {
      await deleteValue(passwordResetKey(previousTokenHash), 'branch');
    }
    await deleteValue(latestPasswordResetKey(userId), 'branch');
  }

  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // In the fragment, which a browser never sends, so the token stays out of
  // request logs and Referer headers.
  private passwordResetUrl(websiteUrl: string, token: string): string {
    return `${websiteUrl}/reset-password#token=${token}`;
  }

  private async readPendingCodes(email: string): Promise<PendingCode[]> {
    const stored = storedCodesSchema.safeParse(
      await getValue<unknown>(loginCodeKey(email), 'branch'),
    );
    if (!stored.success) {
      return [];
    }
    const now = Date.now();
    return stored.data.filter((pending) => pending.expiresAt > now);
  }

  private generateCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  private generateVerificationEmailText(code: string, email: string, websiteUrl: string) {
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

  private generateVerificationEmailHtml(code: string, email: string, websiteUrl: string) {
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

  private generatePasswordResetEmailText(resetUrl: string) {
    return [
      'Hello,',
      '',
      'We received a request to reset the password for your My Expenses account.',
      '',
      `To choose a new password, open this link within 30 minutes: ${resetUrl}`,
      '',
      'The link works once. Resetting your password signs you out on every device.',
      '',
      'If you did not ask for this, you can ignore this email; your password stays as it is.',
      '',
      'Best regards,',
      'The My Expenses Team',
    ].join('\n');
  }

  private generatePasswordResetEmailHtml(resetUrl: string) {
    return `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 480px; margin: 0 auto;">
        <p>Hello,</p>
        <p>We received a request to reset the password for your My Expenses account.</p>
        <p>To choose a new password, open this link within 30 minutes: <a href="${resetUrl}">${resetUrl}</a></p>
        <p>The link works once. Resetting your password signs you out on every device.</p>
        <p>If you did not ask for this, you can ignore this email; your password stays as it is.</p>
        <p style="margin-top: 32px;">Best regards,<br>The My Expenses Team</p>
      </div>
    `;
  }

  private verificationUrl(websiteUrl: string, email: string): string {
    return `${websiteUrl}/verify?email=${encodeURIComponent(email)}`;
  }

  private async sendCodeByEmail(email: string, code: string, websiteUrl: string) {
    await emailService.send({
      to: email,
      subject: 'Your Verification Code',
      text: this.generateVerificationEmailText(code, email, websiteUrl),
      html: this.generateVerificationEmailHtml(code, email, websiteUrl),
    });
  }
}

const authService = new AuthService();
export default authService;
