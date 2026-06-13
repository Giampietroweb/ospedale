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
  '.htaccess',
  'api-client.js',
  'cataloghi.html',
  'cataloghi.js',
  'composer.json',
  'composer.lock',
  'estrazioni.html',
  'estrazioni.js',
  'index.html',
  'manifest.webmanifest',
  'offline-store.js',
  'pwa-register.js',
  'script.js',
  'service-worker.js',
  'sync-engine.js',
  'sync-page.js',
  'sync-ui.js',
  'sync.html',
  'style.css',
  'toolbar-nav.js'
];

const DIRECTORIES_TO_COPY = ['api', 'assets', 'database', 'piani', 'planimetrie', 'test-ai', 'vendor'];

/** File che devono esistere in dist/ dopo la build (fail-fast se mancanti). */
const REQUIRED_BUILD_FILES = [
  '.env.example',
  '.htaccess',
  'api-client.js',
  'api/bundles.php',
  'api/catalog-utils.php',
  'api/catalogs.php',
  'api/config.php',
  'api/database.php',
  'api/estrazioni-export.php',
  'api/estrazioni-query.php',
  'api/estrazioni.php',
  'api/get-room.php',
  'api/get-rooms-for-floor.php',
  'api/save-modal.php',
  'api/sync-history.php',
  'api/utils.php',
  'assets/icons/icon-192.svg',
  'assets/icons/icon-512.svg',
  'assets/vendor/tailwind.css',
  'assets/vendor/tom-select.css',
  'assets/vendor/tom-select.complete.min.js',
  'cataloghi.html',
  'cataloghi.js',
  'composer.json',
  'composer.lock',
  'database/migration-bundles.sql',
  'database/migration-sync-operations.sql',
  'database/schema.sql',
  'estrazioni.html',
  'estrazioni.js',
  'index.html',
  'manifest.webmanifest',
  'offline-store.js',
  'piani/planimetria.html',
  'pwa-register.js',
  'script.js',
  'service-worker.js',
  'style.css',
  'sync-engine.js',
  'sync-page.js',
  'sync-ui.js',
  'sync.html',
  'test-ai/api/list-rooms.php',
  'test-ai/index.html',
  'test-ai/test-ai.js',
  'toolbar-nav.js',
  'vendor/autoload.php',
];

const EXCLUDED_RELATIVE_PATHS = new Set(['api/test-db.php']);

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
  /^Thumbs\.db$/i
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
  'tmp'
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

async function collectPlanimetrieRequirements() {
  const planimetrieRoot = resolve(PROJECT_ROOT, 'planimetrie');
  if (!existsSync(planimetrieRoot)) {
    return [];
  }

  const required = [];
  const entries = await readdir(planimetrieRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const floorName = entry.name;
    const floorFiles = await readdir(resolve(planimetrieRoot, floorName));
    const mainSvg = `${floorName}.svg`;

    if (floorFiles.includes(mainSvg)) {
      required.push(`planimetrie/${floorName}/${mainSvg}`);
    }

    for (const jsonName of [`occorrenze-${floorName}.json`, `occorenze-${floorName}.json`]) {
      if (floorFiles.includes(jsonName)) {
        required.push(`planimetrie/${floorName}/${jsonName}`);
      }
    }
  }

  return required;
}

function assertRequiredBuildFiles(extraRequiredFiles = []) {
  const requiredFiles = [...REQUIRED_BUILD_FILES, ...extraRequiredFiles];
  const missingFiles = requiredFiles.filter(
    (relativePath) => !existsSync(resolve(OUTPUT_DIR, relativePath))
  );

  if (missingFiles.length > 0) {
    throw new Error(
      `Build incompleta: file obbligatori mancanti in dist/:\n${missingFiles.map((file) => `  - ${file}`).join('\n')}`
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
        await walkDirectory(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (shouldExcludeFile(entry.name)) {
        forbiddenFiles.push(relative(OUTPUT_DIR, entryPath));
      }
    }
  }

  await walkDirectory(OUTPUT_DIR);

  if (forbiddenFiles.length > 0) {
    throw new Error(
      `Build incompleta: file non ammessi presenti in dist/:\n${forbiddenFiles.map((file) => `  - ${file}`).join('\n')}`
    );
  }
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

  const planimetrieRequirements = await collectPlanimetrieRequirements();
  assertRequiredBuildFiles(planimetrieRequirements);
  await assertDistHasNoExcludedArtifacts();

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
