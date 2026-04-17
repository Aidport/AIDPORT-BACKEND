import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUrl, MaxLength } from 'class-validator';

/** Replace the list of document URLs (e.g. after POST /upload). Send [] to clear. */
export class UpdateAgentDocumentsDto {
  @ApiProperty({
    type: [String],
    description:
      'Full list of HTTPS URLs to store (replaces existing). Use URLs returned from POST /upload. Also accepts `document_urls`, `urls`, or an array of `{ url }` / `{ secure_url }` (Cloudinary) — normalized server-side.',
    example: ['https://res.cloudinary.com/.../doc.pdf'],
  })
  @IsArray()
  @ArrayMaxSize(30)
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  documentUrls: string[];
}

/** Accepts multiple client shapes before DTO validation (see PATCH /agent/documents). */
export function normalizeAgentDocumentUrlsInput(body: unknown): string[] {
  const extract = (item: unknown): string => {
    if (typeof item === 'string') {
      return item.trim();
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const u =
        (typeof o.url === 'string' && o.url) ||
        (typeof o.secure_url === 'string' && o.secure_url) ||
        (typeof o.secureUrl === 'string' && o.secureUrl) ||
        '';
      return String(u).trim();
    }
    return '';
  };

  if (Array.isArray(body)) {
    return body.map(extract).filter((s) => s.length > 0);
  }
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const raw = o.documentUrls ?? o.document_urls ?? o.urls ?? o.files;
    if (Array.isArray(raw)) {
      return raw.map(extract).filter((s) => s.length > 0);
    }
    const nested = o.agencyProfile;
    const fromNested =
      nested && typeof nested === 'object'
        ? String((nested as Record<string, unknown>).agencyLogo ?? '').trim()
        : '';
    const single =
      (typeof o.agencyLogo === 'string' && o.agencyLogo.trim()) ||
      fromNested ||
      '';
    if (single) {
      return [single];
    }
  }
  return [];
}
