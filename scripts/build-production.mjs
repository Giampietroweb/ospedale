#!/usr/bin/env node
// Prepara dist/ per deploy manuale: mirror del progetto come in produzione
// (allineato a www.tech-giamp.cloud, senza cartelle backup-* e file di sviluppo).

import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(dirname(CURRENT_FILE), '..');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'dist');
const PRODUCTION_REFERENCE_DIR = resolve(PROJECT_ROOT, 'www.tech-giamp.cloud');

/** File presenti solo sul server o generati in dist: non richiesti nel confronto. */
const SERVER_ONLY_REFERENCE_FILES = new Set(['.env', '.htpasswd']);

/** File utili in dist ma assenti nello snapshot di produzione. */
const DIST_ONLY_FILES = new Set(['.env.example']);

const EXCLUDED_RELATIVE_PATHS = new Set(['api/test-db.php']);

const VENDOR_INTEGRITY_FILES = [
  'vendor/autoload.php',
  'vendor/composer/autoload_real.php',
  'vendor/phpoffice/phpspreadsheet/src/PhpSpreadsheet/Calculation/Engine/CyclicReferenceStack.php',
];

const EXCLUDED_FILE_PATTERNS = [
  /\.map$/i,
  /\.log$/i,
  /\.tmp$/i,
  /\.bak$/i,
  /\.backup$/i,
  /-old\.svg$/i,
  /_old\.svg$/i,
  /\.optimized\.svg$/i,
  /^REPORT-/i,
  /^\.DS_Store$/i,
  /^Thumbs\.db$/i,
];

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.cursor',
  '.git',
  '.idea',
  '.vscode',
  'build',
  'coverage',
  'database',
  'dist',
  'docker',
  'documentazione',
  'node_modules',
  'release',
  'scripts',
  'tests',
  'tmp',
  'www.tech-giamp.cloud',
]);

const EXCLUDED_ROOT_FILE_NAMES = new Set([
  '.env',
  '.gitignore',
  'DEPENDENCIES.txt',
  'docker-compose.yml',
  'package-lock.json',
  'package.json',
  'tailwind-input.css',
  'tailwind.config.js',
]);

function isBackupDirectory(directoryName) {
  return /^backup-\d+$/i.test(directoryName);
}

function shouldExcludeFile(fileName) {
  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

function shouldExcludeDirectory(directoryName) {
  return EXCLUDED_DIRECTORY_NAMES.has(directoryName) || isBackupDirectory(directoryName);
}

function shouldExcludeRelativePath(relativePath) {
  return EXCLUDED_RELATIVE_PATHS.has(relativePath);
}

function shouldExcludeRootFile(fileName) {
  return EXCLUDED_ROOT_FILE_NAMES.has(fileName) || shouldExcludeFile(fileName);
}

async function copyFile(sourcePath, destinationPath, copiedFiles) {
  const relativePath = relative(PROJECT_ROOT, sourcePath);
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath);
  copiedFiles.push(relativePath);
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

    await copyFile(sourcePath, destinationPath, copiedFiles);
  }
}

async function copyProjectToDist(copiedFiles) {
  const entries = await readdir(PROJECT_ROOT, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(PROJECT_ROOT, entry.name);
    const destinationPath = join(OUTPUT_DIR, entry.name);
    const relativePath = relative(PROJECT_ROOT, sourcePath);

    if (entry.isDirectory()) {
      if (shouldExcludeDirectory(entry.name)) {
        continue;
      }

      await copyDirectoryContents(sourcePath, destinationPath, copiedFiles);
      continue;
    }

    if (!entry.isFile() || shouldExcludeRootFile(entry.name) || shouldExcludeRelativePath(relativePath)) {
      continue;
    }

    await copyFile(sourcePath, destinationPath, copiedFiles);
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

async function collectRelativeFiles(rootDirectory, options = {}) {
  const files = [];
  const { skipBackupDirectories = false } = options;

  async function walkDirectory(currentDirectory, relativeDirectory = '') {
    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        if (skipBackupDirectories && isBackupDirectory(entry.name)) {
          continue;
        }
        if (shouldExcludeDirectory(entry.name)) {
          continue;
        }

        await walkDirectory(absolutePath, relativePath);
        continue;
      }

      if (!entry.isFile() || shouldExcludeFile(entry.name) || shouldExcludeRelativePath(relativePath)) {
        continue;
      }

      files.push(relativePath);
    }
  }

  await walkDirectory(rootDirectory);
  return files.sort();
}

function assertVendorIntegrity(rootDirectory) {
  const missingFiles = VENDOR_INTEGRITY_FILES.filter(
    (relativePath) => !existsSync(resolve(rootDirectory, relativePath))
  );

  if (missingFiles.length > 0) {
    throw new Error(
      `Vendor incompleto in ${relative(PROJECT_ROOT, rootDirectory)}: esegui 'composer install --no-dev --optimize-autoloader'.\nFile mancanti:\n${missingFiles.map((file) => `  - ${file}`).join('\n')}`
    );
  }
}

async function assertDistHasNoExcludedArtifacts() {
  const forbiddenFiles = [];

  async function walkDirectory(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        if (isBackupDirectory(entry.name)) {
          forbiddenFiles.push(relative(OUTPUT_DIR, entryPath) + '/');
        } else {
          await walkDirectory(entryPath);
        }
        continue;
      }

      if (entry.isFile() && shouldExcludeFile(entry.name)) {
        forbiddenFiles.push(relative(OUTPUT_DIR, entryPath));
      }
    }
  }

  await walkDirectory(OUTPUT_DIR);

  if (forbiddenFiles.length > 0) {
    throw new Error(
      `Build incompleta: file o cartelle non ammessi presenti in dist/:\n${forbiddenFiles.map((file) => `  - ${file}`).join('\n')}`
    );
  }
}

async function assertDistMatchesProductionReference() {
  if (!existsSync(PRODUCTION_REFERENCE_DIR)) {
    console.warn('Avviso: www.tech-giamp.cloud non trovato, salto confronto con produzione.');
    return;
  }

  const isVendorPath = (filePath) => filePath === 'vendor' || filePath.startsWith('vendor/');

  const referenceFiles = (await collectRelativeFiles(PRODUCTION_REFERENCE_DIR, {
    skipBackupDirectories: true,
  })).filter((file) => !isVendorPath(file) && file !== 'build-manifest.json');
  const distFiles = (await collectRelativeFiles(OUTPUT_DIR)).filter(
    (file) => !isVendorPath(file) && file !== 'build-manifest.json'
  );
  const distFileSet = new Set(distFiles);

  const missingInDist = referenceFiles.filter((file) => {
    if (SERVER_ONLY_REFERENCE_FILES.has(file)) {
      return false;
    }
    return !distFileSet.has(file);
  });

  const referenceFileSet = new Set(referenceFiles);
  const unexpectedInDist = distFiles.filter((file) => {
    if (DIST_ONLY_FILES.has(file)) {
      return false;
    }
    return !referenceFileSet.has(file);
  });

  if (missingInDist.length > 0 || unexpectedInDist.length > 0) {
    const details = [];
    if (missingInDist.length > 0) {
      details.push(
        `File presenti in www.tech-giamp.cloud ma mancanti in dist/:\n${missingInDist.map((file) => `  - ${file}`).join('\n')}`
      );
    }
    if (unexpectedInDist.length > 0) {
      details.push(
        `File presenti in dist/ ma non previsti per produzione:\n${unexpectedInDist.map((file) => `  - ${file}`).join('\n')}`
      );
    }
    throw new Error(`Build non allineata alla produzione:\n${details.join('\n\n')}`);
  }
}

async function writeManifest(copiedFiles) {
  const outputSizeBytes = await calculateDirectorySize(OUTPUT_DIR);
  const manifest = {
    generatedAt: new Date().toISOString(),
    outputDirectory: basename(OUTPUT_DIR),
    fileCount: copiedFiles.length,
    outputSize: formatBytes(outputSizeBytes),
    files: copiedFiles.sort(),
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

  assertVendorIntegrity(PROJECT_ROOT);

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  await copyProjectToDist(copiedFiles);

  assertVendorIntegrity(OUTPUT_DIR);
  await assertDistHasNoExcludedArtifacts();
  await assertDistMatchesProductionReference();

  const manifest = await writeManifest(copiedFiles);

  console.log('Build produzione completata');
  console.log(`Output: ${relative(PROJECT_ROOT, OUTPUT_DIR)}`);
  console.log(`File copiati: ${manifest.fileCount}`);
  console.log(`Dimensione: ${manifest.outputSize}`);
}

main().catch((error) => {
  console.error('[build-production] errore:', error.message || error);
  process.exit(1);
});
