export const randomBytes = (size) => {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return {
    toString: (encoding) => {
      if (encoding !== 'hex') {
        throw new Error('Only hex encoding is supported by the Cloudflare crypto shim.');
      }
      return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    },
  };
};

export const createHash = () => {
  throw new Error('node:crypto.createHash is unavailable in the Cloudflare Worker bundle.');
};

export default {
  createHash,
  randomBytes,
};
