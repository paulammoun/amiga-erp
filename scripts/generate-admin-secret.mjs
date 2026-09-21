import { randomBytes, pbkdf2Sync } from 'node:crypto';

// Run privately on the NEW owner's machine. Nothing is written to disk.
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16);
const derived = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
const hash = `pbkdf2-sha256$100000$${salt.toString('base64url')}$${derived.toString('base64url')}`;
console.log('Store the following newly generated password in your password manager.');
console.log('Username: superadmin');
console.log(`Password: ${password}`);
console.log(`SUPERADMIN_PASSWORD_HASH='${hash}'`);
console.log('Use the quoted assignment in .dev.vars; use only the hash value for a Sites secret.');
