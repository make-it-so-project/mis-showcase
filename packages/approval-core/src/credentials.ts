import { ActionCredential, ActionCredentialType } from '@make-it-so/shared';
import { randomBytes } from 'crypto';

/**
 * Generator for one-time action credentials (2FA codes)
 */
export class CredentialGenerator {
  private usedCredentials: Set<string> = new Set();

  constructor(
    private readonly codeLength: number = 6,
    private readonly ttlSeconds: number = 60
  ) {}

  /**
   * Generates a new one-time code
   */
  generate(type: ActionCredentialType = 'one_time_code'): ActionCredential {
    const value = this.generateNumericCode(this.codeLength);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    return {
      type,
      value,
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Validates and consumes a credential.
   * Returns true if the credential is valid and has not been used before.
   */
  validateAndConsume(credential: ActionCredential): boolean {
    // Check expiry
    if (new Date(credential.expires_at) < new Date()) {
      return false;
    }

    // Check if already used
    const key = `${credential.type}:${credential.value}`;
    if (this.usedCredentials.has(key)) {
      return false;
    }

    // Mark as used
    this.usedCredentials.add(key);

    // Clean up after 5 minutes
    setTimeout(() => {
      this.usedCredentials.delete(key);
    }, 5 * 60 * 1000);

    return true;
  }

  /**
   * Generates a numeric code of the given length
   */
  private generateNumericCode(length: number): string {
    const bytes = randomBytes(length);
    let code = '';
    for (let i = 0; i < length; i++) {
      code += (bytes[i]! % 10).toString();
    }
    return code;
  }
}
