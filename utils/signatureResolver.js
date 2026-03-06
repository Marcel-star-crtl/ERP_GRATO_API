/**
 * signatureResolver.js
 * 
 * Drop-in utility to resolve signature image paths reliably
 * across local development (Windows) and Render (Linux).
 * 
 * Place in: utils/signatureResolver.js
 * 
 * Usage anywhere in your code:
 *   const { resolveSignaturePath } = require('../utils/signatureResolver');
 *   const resolvedPath = resolveSignaturePath(user.signature);
 *   if (resolvedPath) doc.image(resolvedPath, x, y, { width: 100 });
 */

const fs   = require('fs');
const path = require('path');

// ── Where signatures are physically stored ────────────────────────────────────
// Priority order — first match wins:
//   1. SIGNATURE_PATH env var  (set this on Render if using a custom mount)
//   2. <project_root>/public/signatures
//   3. <project_root>/uploads/signatures       (fallback)
//   4. /var/data/signatures                    (Render persistent disk fallback)

const SIGNATURE_SEARCH_DIRS = [
  process.env.SIGNATURE_PATH,
  path.resolve(__dirname, '../public/signatures'),
  path.resolve(__dirname, '../uploads/signatures'),
  '/var/data/signatures',
].filter(Boolean);

/**
 * Given a stored signature object (from User.signature), returns the absolute
 * local path to the image file, or null if it cannot be found.
 *
 * Handles four storage formats seen in practice:
 *   1. Absolute Windows path  C:\Users\...\public\signatures\file.png
 *   2. Absolute Linux path    /opt/render/project/src/public/signatures/file.png
 *   3. Relative URL path      /public/signatures/file.png  or  public/signatures/file.png
 *   4. Just a filename        abc123.png
 *
 * @param {object|string|null} signatureData  - User.signature object or raw path string
 * @returns {string|null}
 */
const resolveSignaturePath = (signatureData) => {
  if (!signatureData) return null;

  // Accept either an object ({ localPath, filename, url }) or a plain string
  const storedPath = typeof signatureData === 'string'
    ? signatureData
    : (signatureData.localPath || signatureData.filename || signatureData.url || null);

  if (!storedPath) return null;

  // ── Strategy 1: stored absolute path still works (local dev happy path) ──
  if (path.isAbsolute(storedPath) && fs.existsSync(storedPath)) {
    return storedPath;
  }

  // ── Strategy 2: extract just the filename and search known signature dirs ──
  // Works for both Windows ("C:\...\abc.png") and Linux paths
  const filename = path.basename(storedPath.replace(/\\/g, '/'));

  for (const dir of SIGNATURE_SEARCH_DIRS) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) {
      console.log(`✅ Signature resolved: ${candidate}`);
      return candidate;
    }
  }

  // ── Strategy 3: strip leading slash and resolve from project root ──
  const relative = storedPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const candidates = [
    path.resolve(__dirname, '..', relative),
    path.resolve(process.cwd(), relative),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`✅ Signature resolved (relative): ${candidate}`);
      return candidate;
    }
  }

  console.warn(`⚠️  Signature not found. Stored path: "${storedPath}"`);
  console.warn(`   Searched dirs: ${SIGNATURE_SEARCH_DIRS.join(', ')}`);
  return null;
};

/**
 * Copy all signatures from local public/signatures to Render persistent disk.
 * Run once after attaching the Render disk.
 * 
 *   node -e "require('./utils/signatureResolver').migrateSignaturesToDisk()"
 */
const migrateSignaturesToDisk = async () => {
  const sourceDir  = path.resolve(__dirname, '../public/signatures');
  const targetDir  = process.env.SIGNATURE_PATH || '/var/data/signatures';

  if (!fs.existsSync(sourceDir)) {
    console.log('No local signatures folder found at:', sourceDir);
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const files = fs.readdirSync(sourceDir);
  let copied = 0;

  for (const file of files) {
    const src  = path.join(sourceDir, file);
    const dest = path.join(targetDir, file);

    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      copied++;
      console.log(`  ✅ Copied: ${file}`);
    } else {
      console.log(`  ⏭️  Already exists: ${file}`);
    }
  }

  console.log(`\nDone. ${copied} file(s) copied to ${targetDir}`);
};

module.exports = { resolveSignaturePath, migrateSignaturesToDisk, SIGNATURE_SEARCH_DIRS };


// =============================================================================
// PATCH INSTRUCTIONS FOR pdfService.js
// =============================================================================
//
// 1. At the top of pdfService.js, add:
//
//      const { resolveSignaturePath } = require('../utils/signatureResolver');
//
//
// 2. In drawSignatureSection() — replace every signature image block:
//
//    BEFORE:
//      if (signature?.signaturePath && fs.existsSync(signature.signaturePath)) {
//        doc.image(signature.signaturePath, imgX, imgY, { width: imgWidth });
//      }
//
//    AFTER:
//      const resolvedSigPath = resolveSignaturePath(signature?.signaturePath || signature);
//      if (resolvedSigPath) {
//        doc.image(resolvedSigPath, imgX, imgY, { width: imgWidth });
//      }
//
//
// 3. In drawApproverSignatures() — replace:
//
//    BEFORE:
//      const signaturePath = block.step?.decidedBy?.signature?.localPath;
//      if (signaturePath && fs.existsSync(signaturePath)) {
//        doc.image(signaturePath, x + 10, lineY - 24, { width: 110, height: 36 });
//      }
//
//    AFTER:
//      const resolvedSigPath = resolveSignaturePath(block.step?.decidedBy?.signature);
//      if (resolvedSigPath) {
//        doc.image(resolvedSigPath, x + 10, lineY - 24, { width: 110, height: 36 });
//      }
//
//
// 4. In drawRequesterAcknowledgmentSignature() and drawBuyerAcknowledgmentSignature():
//
//    BEFORE:
//      const signaturePath = acknowledgment?.signatureLocalPath;
//      if (signaturePath && fs.existsSync(signaturePath)) {
//        doc.image(signaturePath, centerX + 10, yPos - 28, { width: 160, height: 36 });
//      }
//
//    AFTER:
//      const resolvedSigPath = resolveSignaturePath(acknowledgment?.signatureLocalPath);
//      if (resolvedSigPath) {
//        doc.image(resolvedSigPath, centerX + 10, yPos - 28, { width: 160, height: 36 });
//      }
//
//
// That's it — no other changes needed. The resolver handles all path formats
// automatically, both on Windows (local) and Linux (Render).
// =============================================================================