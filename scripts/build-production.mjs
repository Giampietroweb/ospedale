#!/usr/bin/env node
// Prepara una cartella dist/ pulita per deploy manuale in produzione.

import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(dirname(CURRENT_FILE), '..');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'dist');

const ROOT_FILES_TO_COPY = [
  '.env.example',
  'cataloghi.html',
  'cataloghi.js',
  'composer.json',
  'composer.lock',
  'estrazioni.html',
  'estrazioni.js',
  'index.html',
  'script.js',
  'style.css'
];

const DIRECTORIES_TO_COPY = ['api', 'piani', 'planimetrie', 'vendor'];

const EXCLUDED_RELATIVE_PATHS = new Set(['api/test-db.php']);

const EXCLUDED_FILE_PATTERNS = [
  /\.map$/i,
  /\.log$/i,
  /\.tmp$/i,
  /\.bak$/i,
  /\.backup$/i,
  /_old\.svg$/i,
  /\.optimized\.svg$/i,
  /^REPORT-/i
];

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.git',
  '.idea',
  '.vscode',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'release',
  'tmp',
  'vendor'
]);

function shouldExcludeFile(fileName) {
  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

function shouldExcludeDirectory(directoryName) {
  return EXCLUDED_DIRECTORY_NAMES.has(directoryName);
}

function shouldExcludeRelativePath(relativePath) {
  return EXCLUDED_RELATIVE_PATHS.has(relativePath);
}

async function copyFileIfExists(relativePath, copiedFiles) {
  const sourcePath = resolve(PROJECT_ROOT, relativePath);
  if (!existsSync(sourcePath)) {
    return;
  }

  const destinationPath = resolve(OUTPUT_DIR, relativePath);
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath);
  copiedFiles.push(relativePath);
}

async function copyDirectoryFiltered(relativeDirectory, copiedFiles) {
  const sourceDirectory = resolve(PROJECT_ROOT, relativeDirectory);
  if (!existsSync(sourceDirectory)) {
    return;
  }

  await copyDirectoryContents(sourceDirectory, resolve(OUTPUT_DIR, relativeDirectory), copiedFiles);
}

async function copyDirectoryContents(sourceDirectory, destinationDirectory, copiedFiles) {
  await mkdir(destinationDirectory, { recursive: true });
  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDirectory, entry.name);
    const destinationPath = join(destinationDirectory, entry.name);
    const relativePath = relative(PROJECT_ROOT, sourcePath);

    if (shouldExcludeRelativePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (shouldExcludeDirectory(entry.name)) {
        continue;
      }

      await copyDirectoryContents(sourcePath, destinationPath, copiedFiles);
      continue;
    }

    if (!entry.isFile() || shouldExcludeFile(entry.name)) {
      continue;
    }

    await mkdir(dirname(destinationPath), { recursive: true });
    await cp(sourcePath, destinationPath);
    copiedFiles.push(relativePath);
  }
}

async function calculateDirectorySize(directoryPath) {
  if (!existsSync(directoryPath)) {
    return 0;
  }

  let totalBytes = 0;
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      totalBytes += await calculateDirectorySize(entryPath);
      continue;
    }

    if (entry.isFile()) {
      const fileStats = await stat(entryPath);
      totalBytes += fileStats.size;
    }
  }

  return totalBytes;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

async function writeManifest(copiedFiles) {
  const outputSizeBytes = await calculateDirectorySize(OUTPUT_DIR);
  const manifest = {
    generatedAt: new Date().toISOString(),
    outputDirectory: basename(OUTPUT_DIR),
    fileCount: copiedFiles.length,
    outputSize: formatBytes(outputSizeBytes),
    files: copiedFiles.sort()
  };

  await writeFile(
    resolve(OUTPUT_DIR, 'build-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  return manifest;
}

async function main() {
  const copiedFiles = [];

  if (!existsSync(resolve(PROJECT_ROOT, 'vendor', 'autoload.php'))) {
    throw new Error(
      "Dipendenze PHP mancanti: esegui 'composer install --no-dev --optimize-autoloader' prima della build produzione."
    );
  }

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const rootFile of ROOT_FILES_TO_COPY) {
    await copyFileIfExists(rootFile, copiedFiles);
  }

  for (const directory of DIRECTORIES_TO_COPY) {
    await copyDirectoryFiltered(directory, copiedFiles);
  }

  const manifest = await writeManifest(copiedFiles);

  console.log('Build produzione completata');
  console.log(`Output: ${relative(PROJECT_ROOT, OUTPUT_DIR)}`);
  console.log(`File copiati: ${manifest.fileCount}`);
  console.log(`Dimensione: ${manifest.outputSize}`);
}

main().catch((error) => {
  console.error('[build-production] errore:', error);
  process.exit(1);
});
