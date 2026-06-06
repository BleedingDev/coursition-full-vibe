import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const marker = ['@effect', 'diagnostics'].join('-');
const markerPattern = new RegExp(`${marker}\\b`, 'u');
const scanTargets = [
  'api',
  'modern.config.ts',
  'oxfmt.config.ts',
  'oxlint.config.ts',
  'postcss.config.mjs',
  'rstest.config.mts',
  'scripts',
  'server',
  'shared',
  'src',
  'tailwind.config.ts',
  'tests',
];
const ignoredDirectories = new Set(['.git', '.modern', 'dist', 'node_modules']);
const scannedExtensions = new Set(['.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
const violations = [];

const toRelativePath = (filePath) => path.relative(root, filePath).split(path.sep).join('/');

const scanFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/u);

  for (const [index, line] of lines.entries()) {
    if (markerPattern.test(line)) {
      violations.push({
        line: index + 1,
        path: toRelativePath(filePath),
        source: line.trim(),
      });
    }
  }
};

const visit = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stats = fs.statSync(targetPath);

  if (stats.isDirectory()) {
    if (ignoredDirectories.has(path.basename(targetPath))) {
      return;
    }

    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      visit(path.join(targetPath, entry.name));
    }

    return;
  }

  if (!stats.isFile() || !scannedExtensions.has(path.extname(targetPath))) {
    return;
  }

  scanFile(targetPath);
};

for (const scanTarget of scanTargets) {
  visit(path.resolve(root, scanTarget));
}

violations.sort((left, right) => {
  const pathOrder = left.path.localeCompare(right.path);
  return pathOrder === 0 ? left.line - right.line : pathOrder;
});

if (violations.length > 0) {
  console.error(
    `Effect diagnostics suppressions are not allowed (${violations.length} occurrence(s)). Remove ${marker} comments instead of disabling diagnostics.`,
  );

  for (const violation of violations) {
    console.error(`${violation.path}:${violation.line}: ${violation.source}`);
  }

  process.exit(1);
}

console.log(`No ${marker} suppressions found.`);
