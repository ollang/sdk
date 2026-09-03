import { OllangClient } from '../client';
import { Language, LanguageValidationResult } from '../types';

/**
 * The platform language catalogue.
 *
 * Order and project creation match language codes exactly and reject anything
 * not in the catalogue, so resolve uncertain codes here rather than guessing.
 * Codes are mostly ISO 639-1 with regional and platform-specific variants
 * (`pt` is Portuguese (Brazil), `pt-PT` is Portugal).
 */
export class Locales {
  constructor(private client: OllangClient) {}

  /** Lists supported languages with their regional variants. */
  async languages(): Promise<Language[]> {
    return this.client.get<Language[]>('/integration/locales/languages');
  }

  /** Searches languages by name, native name or code. */
  async search(query: string): Promise<Language[]> {
    return this.client.get<Language[]>('/integration/locales/search', { q: query });
  }

  /**
   * Checks a language code against the catalogue.
   *
   * Reports whether the code is accepted, its parsed language and region, and
   * why it failed if it did.
   */
  async validate(tag: string): Promise<LanguageValidationResult> {
    return this.client.get<LanguageValidationResult>(
      `/integration/locales/validate/${encodeURIComponent(tag)}`
    );
  }
}
