const unavailable = (method) => () => {
  throw new Error(`node:fs.${method} is unavailable in the Cloudflare Worker bundle.`);
};

export const constants = {
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
};

export const promises = {
  readdir: unavailable('promises.readdir'),
};

export const access = unavailable('access');
export const chmod = unavailable('chmod');
export const chown = unavailable('chown');
export const close = unavailable('close');
export const copyFile = unavailable('copyFile');
export const cp = unavailable('cp');
export const fstat = unavailable('fstat');
export const fsync = unavailable('fsync');
export const ftruncate = unavailable('ftruncate');
export const link = unavailable('link');
export const mkdir = unavailable('mkdir');
export const mkdtemp = unavailable('mkdtemp');
export const open = unavailable('open');
export const read = unavailable('read');
export const readFile = unavailable('readFile');
export const readlink = unavailable('readlink');
export const realpath = unavailable('realpath');
export const rename = unavailable('rename');
export const rm = unavailable('rm');
export const stat = unavailable('stat');
export const symlink = unavailable('symlink');
export const truncate = unavailable('truncate');
export const utimes = unavailable('utimes');
export const watch = unavailable('watch');
export const write = unavailable('write');
export const writeFile = unavailable('writeFile');

export default {
  access,
  chmod,
  chown,
  close,
  constants,
  copyFile,
  cp,
  fstat,
  fsync,
  ftruncate,
  link,
  mkdir,
  mkdtemp,
  open,
  promises,
  read,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  truncate,
  utimes,
  watch,
  write,
  writeFile,
};
