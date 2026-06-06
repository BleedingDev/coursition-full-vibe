import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from '@rstest/core';
import { resolveCurrentLanguage } from '../src/features/coursition/i18n';

const root = process.cwd();
const routePath = 'src/routes/[lang]/page.tsx';
const coursitionFeatureRoot = 'src/features/coursition';

type JsonObject = Record<string, unknown>;

const readText = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf-8');

const readJson = <T>(relativePath: string): T => JSON.parse(readText(relativePath)) as T;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const keyTree = (value: unknown, prefix = ''): string[] => {
  if (!isObject(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.keys(value)
    .toSorted()
    .flatMap((key) => keyTree(value[key], prefix ? `${prefix}.${key}` : key));
};

const collectFiles = (directory: string, pattern: RegExp): string[] => {
  const absoluteDirectory = path.join(root, directory);
  if (!fs.existsSync(absoluteDirectory)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDirectory, entry.name);
    const relativePath = path.relative(root, absolutePath);

    if (entry.isDirectory()) {
      files.push(...collectFiles(relativePath, pattern));
      continue;
    }

    if (entry.isFile() && pattern.test(entry.name)) {
      files.push(relativePath);
    }
  }

  return files.toSorted();
};

const coursitionSourceFiles = () => {
  const files = fs.existsSync(path.join(root, routePath)) ? [routePath] : [];
  files.push(...collectFiles(coursitionFeatureRoot, /\.tsx$/u));
  return files;
};

const stripComments = (content: string) =>
  content.replaceAll(/\/\*[\s\S]*?\*\//gu, '').replaceAll(/(^|[^:])\/\/.*$/gmu, '$1');

describe('Coursition native i18n discipline', () => {
  test('keeps Czech and English Coursition locale key trees aligned', () => {
    const english = readJson<JsonObject>('locales/en/translation.json');
    const czech = readJson<JsonObject>('locales/cs/translation.json');

    expect(keyTree(english.coursition)).toEqual(keyTree(czech.coursition));
  });

  test('does not branch Coursition source on English as a hardcoded language', () => {
    const files = coursitionSourceFiles();

    expect(files).toContain(routePath);

    const violations = files.flatMap((filePath) => {
      const content = stripComments(readText(filePath));
      const matches = [...content.matchAll(/\blanguage\s*===\s*["']en["']/gu)];
      return matches.map((match) => `${filePath}:${match[0]}`);
    });

    expect(violations).toEqual([]);
  });

  test('uses pathname language before stale loader data', () => {
    expect(
      resolveCurrentLanguage({
        loaderLanguage: 'cs',
        pathname: '/en/course-creation/course_123/sources',
        runtimeLanguage: 'en',
      }),
    ).toBe('en');

    expect(
      resolveCurrentLanguage({
        pathname: '/cs/tvorba-kurzu/course_123/zdroje',
        runtimeLanguage: 'en',
      }),
    ).toBe('cs');

    expect(
      resolveCurrentLanguage({
        pathname: '/en/course-creation/course_123/sources',
        runtimeLanguage: 'cs',
      }),
    ).toBe('en');
  });

  test('keeps obvious Coursition product copy out of route and component literals', () => {
    const files = coursitionSourceFiles();
    const hardcodedCopyPatterns = [
      /\bAI Course Studio\b/u,
      /\bCourse Builder\b/u,
      /\bGenerate course for me\b/u,
      /\bHelp me build it\b/u,
      /\bKnowledge Base\b/u,
      /\bPaste a website or source link\b/u,
      /\bContinue without waiting\b/u,
      /\bNeed an AI help\b/u,
      /\bWizzard\b/u,
    ];

    const violations = files.flatMap((filePath) => {
      const content = stripComments(readText(filePath));
      return hardcodedCopyPatterns
        .filter((pattern) => pattern.test(content))
        .map((pattern) => `${filePath}:${pattern.source}`);
    });

    expect(violations).toEqual([]);
  });
});
