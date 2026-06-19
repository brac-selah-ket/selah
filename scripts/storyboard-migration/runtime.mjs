import { stat } from 'node:fs/promises';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export function setupMigrationRuntime(scriptUrl) {
  ensureTypeScriptRuntime(scriptUrl);

  const repoRootUrl = new URL('../../', scriptUrl);
  registerTypeScriptPathLoader(repoRootUrl);

  return {
    repoRootUrl,
  };
}

export async function resolveExistingFileUrl(url) {
  for (const candidate of [url, `${url}.ts`, `${url}.tsx`, `${url}/index.ts`]) {
    try {
      if ((await stat(new URL(candidate))).isFile()) {
        return { url: candidate, shortCircuit: true };
      }
    } catch {}
  }

  return { url, shortCircuit: true };
}

function ensureTypeScriptRuntime(scriptUrl) {
  if (process.execArgv.includes('--experimental-strip-types')) {
    return;
  }

  if (process.env.STORYBOARD_MIGRATION_TS_REEXEC === '1') {
    throw new Error('Unable to enable --experimental-strip-types for storyboard migration script');
  }

  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', fileURLToPath(scriptUrl), ...process.argv.slice(2)],
    {
      env: {
        ...process.env,
        STORYBOARD_MIGRATION_TS_REEXEC: '1',
      },
      stdio: 'inherit',
    },
  );

  if (result.signal) {
    process.kill(process.pid, result.signal);
  }

  process.exit(result.status ?? 1);
}

function registerTypeScriptPathLoader(repoRootUrl) {
  const loader = `
    import { resolveExistingFileUrl } from ${JSON.stringify(import.meta.url)};

    export async function resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('@/')) {
        return resolveExistingFileUrl(new URL(specifier.slice(2), ${JSON.stringify(repoRootUrl.href)}).href);
      }

      try {
        return await nextResolve(specifier, context);
      } catch (error) {
        if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) {
          throw error;
        }

        return resolveExistingFileUrl(new URL(specifier, context.parentURL).href);
      }
    }
  `;

  register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
}
