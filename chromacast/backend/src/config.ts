export interface AppConfig {
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  haUrl: string;
  haToken: string;
  primaryEntityIds: string[];
  secondaryEntityIds: string[];
}

let config: AppConfig | null = null;

export function setConfig(c: AppConfig): void {
  config = c;
}

export function getConfig(): AppConfig | null {
  return config;
}

export function isConfigured(): boolean {
  if (config) return true;
  return !!(
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    process.env.SPOTIFY_REDIRECT_URI
  );
}
