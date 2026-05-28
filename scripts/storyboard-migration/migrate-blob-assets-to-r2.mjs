import { setupMigrationRuntime } from './runtime.mjs';

setupMigrationRuntime(import.meta.url);

const dryRun = !process.argv.includes('--commit');
const limit = readNumberArg('--limit');
const only = readCsvArg('--only');

process.env.DATABASE_PROVIDER = 'turso';
process.env.STORAGE_PROVIDER = 'cloudflare-r2';

const [
  { getTursoDb },
  schema,
  { deleteObject, putObject },
  { createPublicUrl, getObjectKeyFromPublicUrl, requireR2Config },
  { and, eq, isNotNull },
] = await Promise.all([
  import('@/lib/db/turso'),
  import('@/lib/db/turso-schema'),
  import('@/lib/storage'),
  import('@/lib/storage/config'),
  import('drizzle-orm'),
]);

const db = getTursoDb();
const r2PublicBaseUrl = requireValidPublicBaseUrl(process.env.R2_PUBLIC_BASE_URL);

if (!dryRun) {
  requireR2Config();
}

const assetTables = [
  {
    name: 'sheet_music_files',
    table: schema.sheetMusicFiles,
    idColumn: schema.sheetMusicFiles.id,
    urlColumn: schema.sheetMusicFiles.fileUrl,
    select: {
      id: schema.sheetMusicFiles.id,
      url: schema.sheetMusicFiles.fileUrl,
      songId: schema.sheetMusicFiles.songId,
      fileName: schema.sheetMusicFiles.fileName,
      fileType: schema.sheetMusicFiles.fileType,
    },
    setUrl: (url) => ({ fileUrl: url }),
    buildKey: (row) => `sheet-music/${safePath(row.songId)}/${row.id}-${safeFileName(row.fileName)}`,
    contentType: (row, response) => row.fileType || response.headers.get('content-type') || 'application/octet-stream',
  },
  {
    name: 'conti_pdf_exports',
    table: schema.contiPdfExports,
    idColumn: schema.contiPdfExports.id,
    urlColumn: schema.contiPdfExports.pdfUrl,
    select: {
      id: schema.contiPdfExports.id,
      url: schema.contiPdfExports.pdfUrl,
      contiId: schema.contiPdfExports.contiId,
    },
    setUrl: (url) => ({ pdfUrl: url }),
    buildKey: (row) => `conti-exports/${safePath(row.contiId)}/${row.id}.pdf`,
    contentType: (_row, response) => response.headers.get('content-type') || 'application/pdf',
  },
  {
    name: 'song_page_images',
    table: schema.songPageImages,
    idColumn: schema.songPageImages.id,
    urlColumn: schema.songPageImages.imageUrl,
    select: {
      id: schema.songPageImages.id,
      url: schema.songPageImages.imageUrl,
      songId: schema.songPageImages.songId,
      contiId: schema.songPageImages.contiId,
      pageIndex: schema.songPageImages.pageIndex,
    },
    setUrl: (url) => ({ imageUrl: url }),
    buildKey: (row) => `song-pages/${safePath(row.songId)}/${safePath(row.contiId)}/p${row.pageIndex}-${row.id}.jpg`,
    contentType: (_row, response) => response.headers.get('content-type') || 'image/jpeg',
  },
];

validateOnlyTables(only, assetTables);

try {
  const result = await migrateAssets();
  console.log(JSON.stringify(result, null, 2));

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function migrateAssets() {
  const summary = {
    dryRun,
    limit: limit ?? null,
    tables: {},
    migrated: 0,
    planned: 0,
    attempted: 0,
    skippedAlreadyR2: 0,
    skippedMissingUrl: 0,
    skippedUnsupportedSource: 0,
    reusedExistingR2Object: 0,
    errors: [],
  };

  for (const config of assetTables) {
    if (only && !only.has(config.name)) continue;
    if (isLimitReached(summary)) break;

    const rows = await db
      .select(config.select)
      .from(config.table)
      .where(isNotNull(config.urlColumn));
    const tableSummary = {
      scanned: rows.length,
      planned: 0,
      migrated: 0,
      attempted: 0,
      skippedAlreadyR2: 0,
      skippedMissingUrl: 0,
      skippedUnsupportedSource: 0,
      reusedExistingR2Object: 0,
    };

    for (const row of rows) {
      if (isLimitReached(summary)) {
        break;
      }

      if (!row.url) {
        summary.skippedMissingUrl += 1;
        tableSummary.skippedMissingUrl += 1;
        continue;
      }

      if (isAlreadyR2Url(row.url)) {
        summary.skippedAlreadyR2 += 1;
        tableSummary.skippedAlreadyR2 += 1;
        continue;
      }

      const sourceUrl = parseHttpUrl(row.url);
      if (!sourceUrl || !isVercelBlobUrl(sourceUrl)) {
        summary.skippedUnsupportedSource += 1;
        tableSummary.skippedUnsupportedSource += 1;
        console.log(`[skip] ${config.name}:${row.id} unsupported source ${getUrlHost(row.url) ?? 'invalid-url'}`);
        continue;
      }

      const targetKey = config.buildKey(row);
      summary.attempted += 1;
      tableSummary.attempted += 1;

      if (dryRun) {
        summary.planned += 1;
        tableSummary.planned += 1;
        console.log(`[dry-run] ${config.name}:${row.id} ${sourceUrl.host} -> ${targetKey}`);
        continue;
      }

      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) {
          throw new Error(`fetch failed with HTTP ${response.status}`);
        }

        const body = await response.blob();
        const { reusedExistingObject, stored } = await putMigrationObject(targetKey, body, {
          contentType: config.contentType(row, response),
        });

        try {
          await updateAssetUrl(config, row.id, row.url, stored.url);
        } catch (error) {
          if (!reusedExistingObject) {
            await cleanupNewMigrationObject(stored.url);
          }
          throw error;
        }

        if (reusedExistingObject) {
          summary.reusedExistingR2Object += 1;
          tableSummary.reusedExistingR2Object += 1;
        }
        summary.migrated += 1;
        tableSummary.migrated += 1;
        console.log(`[migrated] ${config.name}:${row.id} -> ${stored.url}`);
      } catch (error) {
        summary.errors.push({
          table: config.name,
          id: row.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    summary.tables[config.name] = tableSummary;
  }

  return summary;
}

async function cleanupNewMigrationObject(storedUrl) {
  try {
    await deleteObject(storedUrl);
  } catch (error) {
    console.error(`[cleanup-failed] ${storedUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function updateAssetUrl(config, id, previousUrl, nextUrl) {
  const updatedRows = await db
    .update(config.table)
    .set(config.setUrl(nextUrl))
    .where(and(eq(config.idColumn, id), eq(config.urlColumn, previousUrl)))
    .returning({ id: config.idColumn });

  if (updatedRows.length !== 1) {
    throw new Error('row was changed or deleted before URL update');
  }
}

async function putMigrationObject(key, body, options) {
  try {
    return {
      reusedExistingObject: false,
      stored: await putObject(key, body, {
        ...options,
        allowOverwrite: false,
      }),
    };
  } catch (error) {
    if (!isObjectAlreadyExistsError(error)) {
      throw error;
    }

    return {
      reusedExistingObject: true,
      stored: {
        key,
        url: createPublicUrl(r2PublicBaseUrl, key),
        provider: 'cloudflare-r2',
      },
    };
  }
}

function readNumberArg(name) {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return null;

  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function readCsvArg(name) {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return null;

  const values = arg
    .slice(prefix.length)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error(`${name} must include at least one table`);
  }

  return new Set(values);
}

function validateOnlyTables(onlyTables, configs) {
  if (!onlyTables) return;

  const validNames = new Set(configs.map((config) => config.name));
  const invalidNames = [...onlyTables].filter((name) => !validNames.has(name));
  if (invalidNames.length > 0) {
    throw new Error(`Unknown --only table: ${invalidNames.join(', ')}`);
  }
}

function isLimitReached(summary) {
  return limit !== null && summary.attempted >= limit;
}

function requireValidPublicBaseUrl(value) {
  const publicBaseUrl = value?.trim().replace(/\/+$/, '');
  if (!publicBaseUrl) {
    throw new Error('R2_PUBLIC_BASE_URL is required');
  }

  try {
    const parsed = new URL(publicBaseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('R2_PUBLIC_BASE_URL must be an HTTP(S) URL');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('R2_PUBLIC_BASE_URL')) {
      throw error;
    }
    throw new Error('R2_PUBLIC_BASE_URL must be a valid URL');
  }
}

function isAlreadyR2Url(value) {
  return isHttpUrl(value) && getObjectKeyFromPublicUrl(r2PublicBaseUrl, value) !== null;
}

function isObjectAlreadyExistsError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = 'name' in error ? error.name : null;
  const metadata = '$metadata' in error ? error.$metadata : null;
  const statusCode = metadata && typeof metadata === 'object' && 'httpStatusCode' in metadata
    ? metadata.httpStatusCode
    : null;

  return name === 'PreconditionFailed' || statusCode === 412;
}

function isVercelBlobUrl(url) {
  return url.protocol === 'https:' && (
    url.host === 'blob.vercel-storage.com' ||
    url.host.endsWith('.blob.vercel-storage.com')
  );
}

function parseHttpUrl(value) {
  if (!isHttpUrl(value)) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getUrlHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function isHttpUrl(value) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function safePath(value) {
  return String(value)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function safeFileName(value) {
  const fallback = 'asset';
  const normalized = String(value ?? fallback)
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/[^A-Za-z0-9가-힣._ -]+/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 180)
    .trim();

  return normalized || fallback;
}
