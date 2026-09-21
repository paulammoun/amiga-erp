declare namespace Cloudflare {
  interface Env {
    SUPERADMIN_PASSWORD_HASH?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
