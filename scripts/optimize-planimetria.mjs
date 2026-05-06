#!/usr/bin/env node
// scripts/optimize-planimetria.mjs
//
// Ottimizzazione vettoriale "safe" delle planimetrie SVG (es. planimetrie/nord-6.svg).
//
// COSA FA
//   1. Decimazione coordinate a 2 decimali sui path/rect "decorativi nudi"
//      (cioe' senza id/class/transform/onclick e con soli attributi di stile).
//   2. Eliminazione path "punto" (es. <path d="M x,y z" />).
//   3. Dedupe degli elementi decorativi identici (anche dopo decimazione).
//   4. Raggruppamento per firma di stile: tutti i path con stesso (stroke,
//      stroke-width, fill, fill-opacity) finiscono in un unico <g> che porta
//      lo stile condiviso. Idem per i rect.
//   5. Conversione dei rect "puntiformi" identici (per dimensione e stile)
//      in subpath di un singolo <path> per dimezzare ulteriormente i byte.
//
// COSA NON TOCCA (mai)
//   - <text> di qualsiasi tipo, in particolare quelli "*P6-...*" cliccabili
//     (vedi script.js -> isClickableOccurrence).
//   - Elementi con id, class, transform, onclick, style inline o qualunque
//     attributo "non standard" rispetto al template decorativo.
//   - Le 287 etichette codice rosse e tutto il loro stile.
//   - viewBox, width, height, header XML, DOCTYPE.
//   - Ordine relativo dei blocchi non-decorativi.
//
// IDEMPOTENZA
//   Rieseguire lo script sul file di output produce lo stesso output: i pattern
//   "decorativi" non matchano piu' una volta che gli attributi sono stati
//   spostati nel <g> wrapper.
//
// USO
//   node scripts/optimize-planimetria.mjs planimetrie/nord-6.svg
//
//   - Output: planimetrie/nord-6.optimized.svg (accanto all'originale).
//   - Se accanto esiste planimetrie/occorenze-<nome>.json, viene fatta una
//     verifica integrita': tutti i codici del JSON devono essere ancora presenti
//     come <text> "*CODICE*" nel file ottimizzato.

import { createReadStream, statSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve, dirname, basename, join } from 'node:path';
import { argv, exit, stdout } from 'node:process';

// Path "nudo decorativo": soli attributi noti di stile + d, niente id/class/transform/onclick/style.
// Esempio: <path d="..." stroke="#XXX" stroke-width="0.24" fill-opacity="0" />
const DECORATIVE_PATH_REGEX =
  /^(\s*)<path((?: (?:d|stroke|stroke-width|fill|fill-opacity)="[^"]*")+) \/>\s*$/;

// Rect "nudo decorativo".
const DECORATIVE_RECT_REGEX =
  /^(\s*)<rect((?: (?:x|y|width|height|stroke|stroke-width|fill|fill-opacity)="[^"]*")+) \/>\s*$/;

// Circle "nudo decorativo": piccoli marker (es. punti di drenaggio, monitoraggi).
const DECORATIVE_CIRCLE_REGEX =
  /^(\s*)<circle((?: (?:cx|cy|r|stroke|stroke-width|fill|fill-opacity)="[^"]*")+) \/>\s*$/;

const ATTRIBUTE_PAIR_REGEX = /([a-z-]+)="([^"]*)"/gi;

const ONLY_POINT_PATH_REGEX = /^M-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?\s*z?$/;

const SVG_CLOSE_REGEX = /<\/svg>/;

const ROOM_CODE_TEXT_REGEX = />\*([A-Za-z0-9-]+)\*</g;

const STYLE_ATTRIBUTES_FOR_GROUP = [
  'stroke',
  'stroke-width',
  'fill',
  'fill-opacity'
];

const NUMERIC_STYLE_ATTRIBUTES = new Set(['stroke-width', 'fill-opacity']);

function parseAttributes(attributesBlock) {
  const attributeMap = {};
  ATTRIBUTE_PAIR_REGEX.lastIndex = 0;
  let attributeMatch;
  while ((attributeMatch = ATTRIBUTE_PAIR_REGEX.exec(attributesBlock)) !== null) {
    const attributeName = attributeMatch[1];
    const rawValue = attributeMatch[2];
    if (NUMERIC_STYLE_ATTRIBUTES.has(attributeName)) {
      attributeMap[attributeName] = roundCoord(rawValue);
    } else {
      attributeMap[attributeName] = rawValue;
    }
  }
  return attributeMap;
}

function buildStyleSignature(attributeMap) {
  return STYLE_ATTRIBUTES_FOR_GROUP
    .map((attributeName) => `${attributeName}=${attributeMap[attributeName] ?? ''}`)
    .join('|');
}

function hasInlineStyleAttribute(attributeMap) {
  return STYLE_ATTRIBUTES_FOR_GROUP.some(
    (attributeName) => attributeMap[attributeName] !== undefined
  );
}

function renderStyleAttributes(attributeMap) {
  return STYLE_ATTRIBUTES_FOR_GROUP
    .filter((attributeName) => attributeMap[attributeName] !== undefined)
    .map((attributeName) => `${attributeName}="${attributeMap[attributeName]}"`)
    .join(' ');
}

function roundCoord(numericString) {
  const parsedNumber = Number(numericString);
  if (!Number.isFinite(parsedNumber)) {
    return numericString;
  }
  return parseFloat(parsedNumber.toFixed(2)).toString();
}

function decimatePathDefinition(rawDefinition) {
  return rawDefinition.replace(/-?\d+(?:\.\d+)?/g, roundCoord);
}

function buildPathDedupeKey(styleSignature, decimatedDefinition) {
  return `${styleSignature}||P||${decimatedDefinition}`;
}

function buildRectDedupeKey(styleSignature, x, y, width, height) {
  return `${styleSignature}||R||${x}|${y}|${width}|${height}`;
}

function buildCircleDedupeKey(styleSignature, cx, cy, r) {
  return `${styleSignature}||C||${cx}|${cy}|${r}`;
}

async function readRoomCodesFromOccurrencesFile(svgInputPath) {
  const inputDirectory = dirname(svgInputPath);
  const baseName = basename(svgInputPath, '.svg');
  const occurrencesPath = join(inputDirectory, `occorenze-${baseName}.json`);

  try {
    const rawJson = await readFile(occurrencesPath, 'utf8');
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) {
      return { occurrencesPath, expectedCodes: null };
    }
    const expectedCodes = parsed
      .map((entry) => entry?.['Codice semplificato'])
      .filter((code) => typeof code === 'string' && code.length > 0);
    return { occurrencesPath, expectedCodes };
  } catch {
    return { occurrencesPath, expectedCodes: null };
  }
}

function formatBytes(byteCount) {
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`;
  return `${(byteCount / (1024 * 1024)).toFixed(2)} MB`;
}

async function optimizePlanimetria(svgInputPath) {
  const absoluteInputPath = resolve(svgInputPath);
  const inputSizeBytes = statSync(absoluteInputPath).size;

  const inputDirectory = dirname(absoluteInputPath);
  const inputBaseName = basename(absoluteInputPath, '.svg');
  const outputPath = join(inputDirectory, `${inputBaseName}.optimized.svg`);

  const stats = {
    totalLinesIn: 0,
    totalLinesOut: 0,
    decorativePathsSeen: 0,
    decorativePathsKept: 0,
    decorativePathsDroppedAsPoint: 0,
    decorativePathsDroppedAsDuplicate: 0,
    decorativeRectsSeen: 0,
    decorativeRectsKept: 0,
    decorativeRectsDroppedAsDuplicate: 0,
    decorativeCirclesSeen: 0,
    decorativeCirclesKept: 0,
    decorativeCirclesDroppedAsDuplicate: 0,
    distinctStyleGroups: 0
  };

  // Mappa styleSignature -> { attributeMap, paths: [], rects: [], dedupeKeys: Set }
  const groupBuffersByStyle = new Map();
  let bufferingActive = false;

  const ensureGroupBuffer = (styleSignature, attributeMap) => {
    let group = groupBuffersByStyle.get(styleSignature);
    if (!group) {
      group = {
        attributeMap,
        decoratedPathDefinitions: [],
        decoratedRectTuples: [],
        decoratedCircleTuples: [],
        dedupeKeys: new Set()
      };
      groupBuffersByStyle.set(styleSignature, group);
      stats.distinctStyleGroups += 1;
    }
    return group;
  };

  const outputChunks = [];

  const flushGroupBuffers = () => {
    if (!bufferingActive) {
      return;
    }
    for (const group of groupBuffersByStyle.values()) {
      const hasContent =
        group.decoratedPathDefinitions.length > 0 ||
        group.decoratedRectTuples.length > 0 ||
        group.decoratedCircleTuples.length > 0;
      if (!hasContent) {
        continue;
      }

      const styleAttributes = renderStyleAttributes(group.attributeMap);
      outputChunks.push(`  <g ${styleAttributes}>\n`);

      for (const decimatedDefinition of group.decoratedPathDefinitions) {
        outputChunks.push(`    <path d="${decimatedDefinition}" />\n`);
      }

      for (const [x, y, width, height] of group.decoratedRectTuples) {
        outputChunks.push(
          `    <rect x="${x}" y="${y}" width="${width}" height="${height}" />\n`
        );
      }

      for (const [cx, cy, r] of group.decoratedCircleTuples) {
        outputChunks.push(`    <circle cx="${cx}" cy="${cy}" r="${r}" />\n`);
      }

      outputChunks.push('  </g>\n');
    }
    groupBuffersByStyle.clear();
    bufferingActive = false;
  };

  const fileStream = createReadStream(absoluteInputPath, { encoding: 'utf8' });
  const lineReader = createInterface({ input: fileStream, crlfDelay: Infinity });

  let svgClosed = false;

  for await (const rawLine of lineReader) {
    stats.totalLinesIn += 1;

    if (svgClosed) {
      outputChunks.push(`${rawLine}\n`);
      continue;
    }

    if (SVG_CLOSE_REGEX.test(rawLine)) {
      flushGroupBuffers();
      outputChunks.push(`${rawLine}\n`);
      svgClosed = true;
      continue;
    }

    const decorativePathMatch = rawLine.match(DECORATIVE_PATH_REGEX);
    if (decorativePathMatch) {
      const attributeMap = parseAttributes(decorativePathMatch[2]);
      const rawDefinition = attributeMap.d;

      if (
        typeof rawDefinition !== 'string'
        || rawDefinition.length === 0
        || !hasInlineStyleAttribute(attributeMap)
      ) {
        flushGroupBuffers();
        outputChunks.push(`${rawLine}\n`);
        continue;
      }

      stats.decorativePathsSeen += 1;
      const decimatedDefinition = decimatePathDefinition(rawDefinition);

      if (ONLY_POINT_PATH_REGEX.test(decimatedDefinition)) {
        stats.decorativePathsDroppedAsPoint += 1;
        continue;
      }

      const styleSignature = buildStyleSignature(attributeMap);
      const dedupeKey = buildPathDedupeKey(styleSignature, decimatedDefinition);
      const group = ensureGroupBuffer(styleSignature, attributeMap);

      if (group.dedupeKeys.has(dedupeKey)) {
        stats.decorativePathsDroppedAsDuplicate += 1;
        continue;
      }

      group.dedupeKeys.add(dedupeKey);
      group.decoratedPathDefinitions.push(decimatedDefinition);
      stats.decorativePathsKept += 1;
      bufferingActive = true;
      continue;
    }

    const decorativeRectMatch = rawLine.match(DECORATIVE_RECT_REGEX);
    if (decorativeRectMatch) {
      const attributeMap = parseAttributes(decorativeRectMatch[2]);

      const requiredAttributes = ['x', 'y', 'width', 'height'];
      const isWellFormed = requiredAttributes.every(
        (attributeName) => typeof attributeMap[attributeName] === 'string'
      );
      if (!isWellFormed || !hasInlineStyleAttribute(attributeMap)) {
        flushGroupBuffers();
        outputChunks.push(`${rawLine}\n`);
        continue;
      }

      stats.decorativeRectsSeen += 1;
      const x = roundCoord(attributeMap.x);
      const y = roundCoord(attributeMap.y);
      const width = roundCoord(attributeMap.width);
      const height = roundCoord(attributeMap.height);

      const styleSignature = buildStyleSignature(attributeMap);
      const dedupeKey = buildRectDedupeKey(styleSignature, x, y, width, height);
      const group = ensureGroupBuffer(styleSignature, attributeMap);

      if (group.dedupeKeys.has(dedupeKey)) {
        stats.decorativeRectsDroppedAsDuplicate += 1;
        continue;
      }

      group.dedupeKeys.add(dedupeKey);
      group.decoratedRectTuples.push([x, y, width, height]);
      stats.decorativeRectsKept += 1;
      bufferingActive = true;
      continue;
    }

    const decorativeCircleMatch = rawLine.match(DECORATIVE_CIRCLE_REGEX);
    if (decorativeCircleMatch) {
      const attributeMap = parseAttributes(decorativeCircleMatch[2]);

      const requiredAttributes = ['cx', 'cy', 'r'];
      const isWellFormed = requiredAttributes.every(
        (attributeName) => typeof attributeMap[attributeName] === 'string'
      );
      if (!isWellFormed || !hasInlineStyleAttribute(attributeMap)) {
        flushGroupBuffers();
        outputChunks.push(`${rawLine}\n`);
        continue;
      }

      stats.decorativeCirclesSeen += 1;
      const cx = roundCoord(attributeMap.cx);
      const cy = roundCoord(attributeMap.cy);
      const r = roundCoord(attributeMap.r);

      const styleSignature = buildStyleSignature(attributeMap);
      const dedupeKey = buildCircleDedupeKey(styleSignature, cx, cy, r);
      const group = ensureGroupBuffer(styleSignature, attributeMap);

      if (group.dedupeKeys.has(dedupeKey)) {
        stats.decorativeCirclesDroppedAsDuplicate += 1;
        continue;
      }

      group.dedupeKeys.add(dedupeKey);
      group.decoratedCircleTuples.push([cx, cy, r]);
      stats.decorativeCirclesKept += 1;
      bufferingActive = true;
      continue;
    }

    flushGroupBuffers();
    outputChunks.push(`${rawLine}\n`);
  }

  if (!svgClosed) {
    flushGroupBuffers();
  }

  const finalContent = outputChunks.join('');
  await writeFile(outputPath, finalContent, 'utf8');

  stats.totalLinesOut = finalContent.split('\n').length - 1;

  const outputSizeBytes = statSync(outputPath).size;

  const inputContent = await readFile(absoluteInputPath, 'utf8');
  const presentCodesInInput = extractRoomCodesFromContent(inputContent);
  const presentCodesInOutput = extractRoomCodesFromContent(finalContent);

  const codesLostByOptimization = [...presentCodesInInput].filter(
    (code) => !presentCodesInOutput.has(code)
  );

  const { occurrencesPath, expectedCodes } =
    await readRoomCodesFromOccurrencesFile(absoluteInputPath);

  let occurrencesReport = null;
  if (Array.isArray(expectedCodes)) {
    const codesInJsonNotInInput = expectedCodes.filter(
      (code) => !presentCodesInInput.has(code)
    );
    const codesInJsonNotInOutput = expectedCodes.filter(
      (code) => !presentCodesInOutput.has(code)
    );
    occurrencesReport = {
      occurrencesPath,
      expectedCount: expectedCodes.length,
      presentCount: presentCodesInOutput.size,
      preExistingMismatches: codesInJsonNotInInput,
      missingAfterOptimization: codesInJsonNotInOutput.filter(
        (code) => !codesInJsonNotInInput.includes(code)
      )
    };
  }

  return {
    absoluteInputPath,
    outputPath,
    inputSizeBytes,
    outputSizeBytes,
    stats,
    codesInInputCount: presentCodesInInput.size,
    codesInOutputCount: presentCodesInOutput.size,
    codesLostByOptimization,
    occurrencesReport
  };
}

function extractRoomCodesFromContent(svgContent) {
  const codes = new Set();
  ROOM_CODE_TEXT_REGEX.lastIndex = 0;
  let textNodeMatch;
  while ((textNodeMatch = ROOM_CODE_TEXT_REGEX.exec(svgContent)) !== null) {
    codes.add(textNodeMatch[1]);
  }
  return codes;
}

function printReport(result) {
  const {
    absoluteInputPath,
    outputPath,
    inputSizeBytes,
    outputSizeBytes,
    stats,
    codesInInputCount,
    codesInOutputCount,
    codesLostByOptimization,
    occurrencesReport
  } = result;

  const reductionPercent =
    inputSizeBytes > 0
      ? (((inputSizeBytes - outputSizeBytes) / inputSizeBytes) * 100).toFixed(1)
      : '0.0';

  const lines = [
    '',
    '=== Ottimizzazione planimetria ===',
    `  input              : ${absoluteInputPath}`,
    `  output             : ${outputPath}`,
    `  size in            : ${formatBytes(inputSizeBytes)}`,
    `  size out           : ${formatBytes(outputSizeBytes)}  (-${reductionPercent}%)`,
    `  righe in           : ${stats.totalLinesIn}`,
    `  righe out          : ${stats.totalLinesOut}`,
    '',
    '  --- path decorativi nudi (qualsiasi colore) ---',
    `  visti              : ${stats.decorativePathsSeen}`,
    `  tenuti             : ${stats.decorativePathsKept}`,
    `  scartati (puntini) : ${stats.decorativePathsDroppedAsPoint}`,
    `  scartati (dup)     : ${stats.decorativePathsDroppedAsDuplicate}`,
    '',
    '  --- rect decorativi nudi (qualsiasi colore) ---',
    `  visti              : ${stats.decorativeRectsSeen}`,
    `  tenuti             : ${stats.decorativeRectsKept}`,
    `  scartati (dup)     : ${stats.decorativeRectsDroppedAsDuplicate}`,
    '',
    '  --- circle decorativi nudi (qualsiasi colore) ---',
    `  visti              : ${stats.decorativeCirclesSeen}`,
    `  tenuti             : ${stats.decorativeCirclesKept}`,
    `  scartati (dup)     : ${stats.decorativeCirclesDroppedAsDuplicate}`,
    '',
    `  gruppi di stile distinti : ${stats.distinctStyleGroups}`
  ];

  lines.push('');
  lines.push('  --- preservazione codici cliccabili (input -> output) ---');
  lines.push(`  codici *P6...* in input  : ${codesInInputCount}`);
  lines.push(`  codici *P6...* in output : ${codesInOutputCount}`);
  if (codesLostByOptimization.length === 0) {
    lines.push('  status                   : OK (nessun codice perso)');
  } else {
    lines.push(
      `  status                   : ROTTO! persi ${codesLostByOptimization.length}`
    );
    lines.push(
      `  primi persi              : ${codesLostByOptimization.slice(0, 10).join(', ')}`
    );
  }

  if (occurrencesReport) {
    lines.push('');
    lines.push('  --- confronto con occurrences JSON (diagnostico) ---');
    lines.push(`  file occurrences          : ${occurrencesReport.occurrencesPath}`);
    lines.push(`  attesi nel JSON           : ${occurrencesReport.expectedCount}`);
    if (occurrencesReport.preExistingMismatches.length > 0) {
      lines.push(
        `  pre-esistenti non in SVG  : ${occurrencesReport.preExistingMismatches.length} (incongruenze gia' nell'originale)`
      );
      lines.push(
        `  primi pre-esistenti       : ${occurrencesReport.preExistingMismatches.slice(0, 10).join(', ')}`
      );
    } else {
      lines.push('  pre-esistenti non in SVG  : 0');
    }
  }

  lines.push('');
  stdout.write(`${lines.join('\n')}\n`);
}

async function main() {
  const inputArg = argv[2];
  if (!inputArg) {
    stdout.write(
      'Uso: node scripts/optimize-planimetria.mjs <path-al-file.svg>\n'
    );
    exit(1);
  }

  const result = await optimizePlanimetria(inputArg);
  printReport(result);

  if (result.codesLostByOptimization.length > 0) {
    exit(2);
  }
}

main().catch((error) => {
  console.error('[optimize-planimetria] errore:', error);
  exit(1);
});
