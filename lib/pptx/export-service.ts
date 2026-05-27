import type {
  ActionResult,
  PptxDriveFile,
  PptxExportRequest,
  PptxExportResult,
  PptxExportScriptureData,
  PptxExportSongData,
  PptxTemplateStructure,
} from '@/lib/types';
import { findAllowedPptxFile } from '@/lib/utils/pptx-helpers';

function getPptxApiUrl(): string {
  if (process.env.PPTX_API_URL) {
    return process.env.PPTX_API_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/pptx`;
  }
  return 'http://localhost:3000/api/pptx';
}

function getPptxHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${process.env.AUTH_SECRET}`,
    ...extra,
  };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  return headers;
}

type GoogleServiceAccountJson = {
  client_email?: string;
  private_key?: string;
};

function parseServiceAccountJson(rawJson: string): GoogleServiceAccountJson | null {
  const candidates = [
    rawJson,
    rawJson.replace(/\r?\n/g, '\\n'),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as GoogleServiceAccountJson;
    } catch {}
  }

  return null;
}

function getServiceAccountCredentials(): { clientEmail: string; privateKey: string } {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = parseServiceAccountJson(rawJson);
    if (parsed?.client_email && parsed.private_key) {
      return {
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      };
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return {
      clientEmail,
      privateKey,
    };
  }

  throw new Error('Google service account credentials are not configured');
}

function normalizePrivateKey(value: string): string {
  let normalized = value.trim();
  while (normalized.startsWith('"') && normalized.endsWith('"') && normalized.length >= 2) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized.replace(/\\n/g, '\n').trim();
}

/**
 * Get Google API access token from service account credentials.
 * Creates a self-signed JWT and exchanges it for an access token.
 * Uses Web Crypto API (Edge Runtime compatible).
 */
async function getGoogleAccessToken(): Promise<string> {
  const { clientEmail, privateKey } = getServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const toBase64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const unsignedToken = `${toBase64Url(header)}.${toBase64Url(payload)}`;

  const pemKey = normalizePrivateKey(privateKey)
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const keyBuffer = Uint8Array.from(atob(pemKey), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${unsignedToken}.${sig}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

export async function listPptxFilesFromDrive(): Promise<ActionResult<{ files: PptxDriveFile[] }>> {
  try {
    const folderId = process.env.GOOGLE_DRIVE_TEMPLATE_FOLDER_ID;
    if (!folderId) {
      return { success: false, error: 'GOOGLE_DRIVE_TEMPLATE_FOLDER_ID가 설정되지 않았습니다' };
    }

    const accessToken = await getGoogleAccessToken();
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false and mimeType='application/vnd.openxmlformats-officedocument.presentationml.presentation'`,
      fields: 'files(id,name,modifiedTime)',
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[listPptxFilesFromDrive] Drive API error:', err);
      return { success: false, error: '파일 목록을 가져오지 못했습니다' };
    }

    const data = await response.json();
    const files: PptxDriveFile[] = (data.files || [])
      .map((f: { id: string; name: string; modifiedTime?: string }) => ({
        file_id: f.id,
        name: f.name,
        modified_time: f.modifiedTime || '',
      }))
      .sort((a: PptxDriveFile, b: PptxDriveFile) => b.name.localeCompare(a.name));

    return { success: true, data: { files } };
  } catch (error) {
    console.error('[listPptxFilesFromDrive]', error);
    return { success: false, error: '파일 목록을 가져오는 중 오류가 발생했습니다' };
  }
}

export async function ensurePptxFileAllowed(fileId: string): Promise<ActionResult<PptxDriveFile>> {
  if (!fileId) {
    return { success: false, error: 'PPT 파일을 선택해 주세요' };
  }

  const filesResult = await listPptxFilesFromDrive();
  if (!filesResult.success || !filesResult.data) {
    return { success: false, error: filesResult.error || 'PPT 파일을 확인하지 못했습니다' };
  }

  const allowedFile = findAllowedPptxFile(filesResult.data.files, fileId);
  if (!allowedFile) {
    return { success: false, error: '선택한 PPT 파일을 템플릿 폴더에서 찾을 수 없습니다' };
  }

  return { success: true, data: allowedFile };
}

export async function sendPptxExportRequest(options: {
  fileId: string;
  overwrite: boolean;
  outputFileName?: string;
  songs: PptxExportSongData[];
  scripture?: PptxExportScriptureData;
  outputFolderId?: string;
}): Promise<ActionResult<PptxExportResult>> {
  try {
    const url = getPptxApiUrl();
    const headers = getPptxHeaders({ 'Content-Type': 'application/json' });
    const body: PptxExportRequest = {
      action: 'export_lyrics',
      file_id: options.fileId,
      overwrite: options.overwrite,
      output_file_name: options.outputFileName,
      output_folder_id: options.outputFolderId,
      songs: options.songs,
    };

    if (options.scripture) {
      body.scripture = options.scripture;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let result: { success: boolean; error?: string; data?: PptxExportResult };
    try {
      result = JSON.parse(text);
    } catch {
      console.error('[sendPptxExportRequest] Non-JSON response:', response.status, text.slice(0, 500));
      return {
        success: false,
        error: `PPT 서버 오류 (${response.status}): 응답을 처리할 수 없습니다`,
      };
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'PPT 내보내기에 실패했습니다',
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error('[sendPptxExportRequest]', error);
    return {
      success: false,
      error: 'PPT 내보내기 중 오류가 발생했습니다',
    };
  }
}

export async function sendPptxInspectRequest(
  fileId: string
): Promise<ActionResult<PptxTemplateStructure>> {
  try {
    const response = await fetch(getPptxApiUrl(), {
      method: 'GET',
      headers: getPptxHeaders({
        'X-Action': 'inspect',
        'X-File-Id': fileId,
      }),
    });

    const text = await response.text();
    let result: { success: boolean; error?: string; data?: PptxTemplateStructure };
    try {
      result = JSON.parse(text);
    } catch {
      console.error('[sendPptxInspectRequest] Non-JSON response:', response.status, text.slice(0, 500));
      return { success: false, error: `PPT 서버 오류 (${response.status}): 응답을 처리할 수 없습니다` };
    }

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('[sendPptxInspectRequest]', error);
    return { success: false, error: '템플릿 검사 중 오류가 발생했습니다' };
  }
}
