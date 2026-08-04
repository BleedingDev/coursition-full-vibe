/*
 * Password hashing for better-auth.
 *
 * better-auth defaults to scrypt, and `@better-auth/utils` maps both `node` and
 * `workerd` to the `node:crypto` implementation. On Cloudflare Workers that call
 * never invokes its callback, so a sign-up request hangs until the client gives
 * up. PBKDF2 over Web Crypto is native on workerd and on Node, so the same
 * implementation runs in both places and an account created locally still works
 * once it reaches Cloudflare.
 *
 * Stored format is `pbkdf2$<iterations>$<salt-hex>$<derived-hex>`; the
 * parameters travel with the hash so they can be raised later without
 * invalidating existing passwords.
 */
/* workerd rejects PBKDF2 above 100k iterations, which is below the 600k OWASP
 * suggests for PBKDF2-HMAC-SHA256. The stored hash carries its own iteration
 * count, so raising this later only affects newly set passwords. */
const iterations = 100_000;
const derivedKeyBits = 256;
const saltBytes = 16;
const algorithm = 'pbkdf2';

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const fromHex = (value: string) => {
  const bytes = new Uint8Array(new ArrayBuffer(value.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const deriveKey = (password: string, salt: Uint8Array<ArrayBuffer>, rounds: number) =>
  crypto.subtle
    .importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, [
      'deriveBits',
    ])
    .then((key) =>
      crypto.subtle.deriveBits(
        { hash: 'SHA-256', iterations: rounds, name: 'PBKDF2', salt },
        key,
        derivedKeyBits,
      ),
    )
    .then((derived) => new Uint8Array(derived));

export const hashCoursitionPassword = (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(saltBytes)));
  return deriveKey(password, salt, iterations).then(
    (derived) => `${algorithm}$${iterations}$${toHex(salt)}$${toHex(derived)}`,
  );
};

export const verifyCoursitionPassword = ({
  hash,
  password,
}: {
  hash: string;
  password: string;
}) => {
  const [scheme, roundsText, saltHex, derivedHex] = hash.split('$');
  if (
    scheme !== algorithm ||
    roundsText === undefined ||
    saltHex === undefined ||
    derivedHex === undefined
  ) {
    return Promise.resolve(false);
  }
  const rounds = Math.trunc(Number(roundsText));
  if (!Number.isFinite(rounds)) {
    return Promise.resolve(false);
  }
  const expected = fromHex(derivedHex);
  return deriveKey(password, fromHex(saltHex), rounds).then((derived) => {
    if (derived.length !== expected.length) {
      return false;
    }
    /* Constant-time comparison: every byte is visited whatever the outcome, so
     * the timing does not leak how much of the derived key matched. Summed
     * absolute differences stand in for the usual XOR fold, which the lint rules
     * disallow, and reach zero on exactly the same input. */
    let difference = 0;
    for (let index = 0; index < derived.length; index += 1) {
      difference += Math.abs((derived[index] ?? 0) - (expected[index] ?? 0));
    }
    return difference === 0;
  });
};
