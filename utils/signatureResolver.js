/**
 * signatureResolver.js
 *
 * Updated for Cloudinary.
 * - If signature.url is a Cloudinary URL → return it directly
 * - Otherwise → fall back to disk search (legacy / transition period)
 *
 * Place at: utils/signatureResolver.js
 */

const fs   = require('fs');
const path = require('path');

// Legacy disk search dirs (used only for files not yet migrated to Cloudinary)
const SIGNATURE_SEARCH_DIRS = [
  process.env.SIGNATURE_PATH,
  '/var/data/user-signatures',
  '/var/data/signatures',
  path.resolve(__dirname, '../uploads/user-signatures'),
  path.resolve(__dirname, '../public/signatures'),
  path.resolve(__dirname, '../uploads/signatures'),
].filter(Boolean);

const isCloudinaryUrl = (str = '') =>
  str.startsWith('https://res.cloudinary.com') ||
  str.startsWith('http://res.cloudinary.com');

/**
 * resolveSignaturePath
 *
 * Returns either:
 *   { type: 'cloudinary', url: '...' }   — use res.redirect() or proxy
 *   { type: 'local', filePath: '...' }   — use doc.image(filePath)
 *   null                                  — not found
 *
 * For PDFService (which calls doc.image()), check type first:
 *
 *   const resolved = resolveSignaturePath(user.signature);
 *   if (resolved?.type === 'cloudinary') {
 *     // download to temp buffer, then doc.image(buffer)
 *   } else if (resolved?.type === 'local') {
 *     doc.image(resolved.filePath, ...)
 *   }
 */
const resolveSignaturePath = (signatureData) => {
  if (!signatureData) return null;

  const storedUrl = typeof signatureData === 'string'
    ? signatureData
    : (signatureData.url || signatureData.localPath || signatureData.filename || null);

  if (!storedUrl) return null;

  // ── Cloudinary (new files) ────────────────────────────────────────────────
  if (isCloudinaryUrl(storedUrl)) {
    return { type: 'cloudinary', url: storedUrl };
  }

  // ── Legacy disk search ────────────────────────────────────────────────────
  if (path.isAbsolute(storedUrl) && fs.existsSync(storedUrl)) {
    return { type: 'local', filePath: storedUrl };
  }

  const normalised = storedUrl.replace(/\\/g, '/');
  const filename   = path.basename(normalised);

  for (const dir of SIGNATURE_SEARCH_DIRS) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) {
      console.log(`✅ Signature resolved (local): ${candidate}`);
      return { type: 'local', filePath: candidate };
    }
  }

  const relative   = normalised.replace(/^\/+/, '');
  const candidates = [
    path.resolve(__dirname, '..', relative),
    path.resolve(process.cwd(), relative),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`✅ Signature resolved (relative): ${candidate}`);
      return { type: 'local', filePath: candidate };
    }
  }

  console.warn(`⚠️  Signature not found. Stored: "${storedUrl}"`);
  return null;
};

/**
 * downloadCloudinaryToBuffer
 *
 * Downloads a Cloudinary URL to a Buffer so PDFKit can use doc.image(buffer).
 * Required for Cloudinary signatures in PDF generation.
 *
 * Usage in pdfService.js:
 *
 *   const { resolveSignaturePath, downloadCloudinaryToBuffer } = require('../utils/signatureResolver');
 *
 *   const resolved = resolveSignaturePath(signature);
 *   if (resolved?.type === 'cloudinary') {
 *     const buffer = await downloadCloudinaryToBuffer(resolved.url);
 *     if (buffer) doc.image(buffer, x, y, { width: 80 });
 *   } else if (resolved?.type === 'local') {
 *     doc.image(resolved.filePath, x, y, { width: 80 });
 *   }
 */
const downloadCloudinaryToBuffer = (url) => {
  const https = require('https');
  const http  = require('http');
  const lib   = url.startsWith('https') ? https : http;

  return new Promise((resolve) => {
    lib.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`⚠️  Could not download signature from Cloudinary (${res.statusCode}): ${url}`);
        return resolve(null);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end',  ()    => resolve(Buffer.concat(chunks)));
      res.on('error', err  => {
        console.warn('⚠️  Signature download stream error:', err.message);
        resolve(null);
      });
    }).on('error', (err) => {
      console.warn('⚠️  Signature download request error:', err.message);
      resolve(null);
    });
  });
};

/**
 * migrateSignaturesToDisk — kept for legacy compat, no-op if Cloudinary is active
 */
const migrateSignaturesToDisk = async () => {
  console.log('ℹ️  migrateSignaturesToDisk: use migrate-to-cloudinary.js instead');
};

module.exports = {
  resolveSignaturePath,
  downloadCloudinaryToBuffer,
  migrateSignaturesToDisk,
  SIGNATURE_SEARCH_DIRS,
};









// /**
//  * signatureResolver.js
//  *
//  * Resolves signature image paths reliably across local Windows dev and Render (Linux).
//  * Place in: utils/signatureResolver.js
//  */

// const fs   = require('fs');
// const path = require('path');

// // Search dirs in priority order — first match wins
// const SIGNATURE_SEARCH_DIRS = [
//   process.env.SIGNATURE_PATH,                                    // Render env var (highest priority)
//   '/var/data/user-signatures',                                   // Render persistent disk (actual folder)
//   '/var/data/signatures',                                        // Render persistent disk (fallback)
//   path.resolve(__dirname, '../uploads/user-signatures'),         // ✅ actual local storage folder
//   path.resolve(__dirname, '../public/signatures'),               // old migration folder
//   path.resolve(__dirname, '../uploads/signatures'),              // generic fallback
// ].filter(Boolean);

// /**
//  * Resolves a stored signature path/object to an absolute local path.
//  *
//  * Accepts:
//  *   - User.signature object  { localPath, filename, url }
//  *   - A raw path string      "C:\Users\...\uploads\user-signatures\abc.png"
//  *   - A filename string      "abc.png"
//  *
//  * @param {object|string|null} signatureData
//  * @returns {string|null}  Absolute path if found, null otherwise
//  */
// const resolveSignaturePath = (signatureData) => {
//   if (!signatureData) return null;

//   const storedPath = typeof signatureData === 'string'
//     ? signatureData
//     : (signatureData.localPath || signatureData.filename || signatureData.url || null);

//   if (!storedPath) return null;

//   // Strategy 1: stored absolute path still works (local dev happy path)
//   if (path.isAbsolute(storedPath) && fs.existsSync(storedPath)) {
//     return storedPath;
//   }

//   // Strategy 2: extract filename and search all known signature dirs
//   // Normalise Windows backslashes first
//   const normalised = storedPath.replace(/\\/g, '/');
//   const filename   = path.basename(normalised);

//   for (const dir of SIGNATURE_SEARCH_DIRS) {
//     const candidate = path.join(dir, filename);
//     if (fs.existsSync(candidate)) {
//       console.log(`✅ Signature resolved: ${candidate}`);
//       return candidate;
//     }
//   }

//   // Strategy 3: strip leading slash and resolve relative to project root
//   const relative = normalised.replace(/^\/+/, '');
//   const candidates = [
//     path.resolve(__dirname, '..', relative),
//     path.resolve(process.cwd(), relative),
//   ];

//   for (const candidate of candidates) {
//     if (fs.existsSync(candidate)) {
//       console.log(`✅ Signature resolved (relative): ${candidate}`);
//       return candidate;
//     }
//   }

//   console.warn(`⚠️  Signature not found. Stored path: "${storedPath}"`);
//   console.warn(`   Searched dirs: ${SIGNATURE_SEARCH_DIRS.join(', ')}`);
//   return null;
// };

// /**
//  * Migrates signature files to Render persistent disk.
//  *
//  * Copies from BOTH known local signature folders:
//  *   - uploads/user-signatures/   ← where new signatures are saved
//  *   - public/signatures/         ← where old signatures lived
//  *
//  * Run once after attaching the Render disk:
//  *   node -e "require('./utils/signatureResolver').migrateSignaturesToDisk()"
//  */
// const migrateSignaturesToDisk = async () => {
//   const targetDir = '/var/data/user-signatures';
//   fs.mkdirSync(targetDir, { recursive: true });

//   const sourceDirs = [
//     path.resolve(__dirname, '../uploads/user-signatures'),
//     path.resolve(__dirname, '../public/signatures'),
//   ];

//   let totalCopied = 0;

//   for (const sourceDir of sourceDirs) {
//     if (!fs.existsSync(sourceDir)) {
//       console.log(`ℹ️  Skipping (not found): ${sourceDir}`);
//       continue;
//     }

//     console.log(`\n📂 Copying from: ${sourceDir}`);
//     const files = fs.readdirSync(sourceDir);

//     for (const file of files) {
//       const src  = path.join(sourceDir, file);
//       const dest = path.join(targetDir, file);

//       if (!fs.statSync(src).isFile()) continue; // skip subdirs

//       if (!fs.existsSync(dest)) {
//         fs.copyFileSync(src, dest);
//         totalCopied++;
//         console.log(`  ✅ Copied: ${file}`);
//       } else {
//         console.log(`  ⏭️  Already exists: ${file}`);
//       }
//     }
//   }

//   console.log(`\nDone. ${totalCopied} file(s) copied to ${targetDir}`);
// };

// module.exports = { resolveSignaturePath, migrateSignaturesToDisk, SIGNATURE_SEARCH_DIRS };

