#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Translation Validation Script
 * Validates all translation files for:
 * - JSON syntax
 * - Required _meta object
 * - Key completeness (all English keys exist in other languages)
 * - File size limits (500KB max)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/locales');
const MAX_FILE_SIZE = 500 * 1024; // 500KB
const REQUIRED_LANGUAGES = ['en'];
const OPTIONAL_LANGUAGES = ['es'];
const REQUIRED_NAMESPACES = ['common', 'settings'];

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

let errorCount = 0;
let warningCount = 0;

function log(level, message) {
  const timestamp = new Date().toISOString();
  switch (level) {
    case 'error':
      console.error(`${colors.red}[ERROR]${colors.reset} ${timestamp} - ${message}`);
      errorCount++;
      break;
    case 'warn':
      console.warn(`${colors.yellow}[WARN]${colors.reset} ${timestamp} - ${message}`);
      warningCount++;
      break;
    case 'info':
      console.log(`${colors.blue}[INFO]${colors.reset} ${timestamp} - ${message}`);
      break;
    case 'success':
      console.log(`${colors.green}[OK]${colors.reset} ${timestamp} - ${message}`);
      break;
  }
}

function validateJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    log('error', `Invalid JSON in ${filePath}: ${error.message}`);
    return null;
  }
}

function validateMeta(obj, filePath) {
  if (!obj._meta) {
    log('error', `Missing _meta object in ${filePath}`);
    return false;
  }

  const { type, version } = obj._meta;

  if (!type) {
    log('error', `Missing _meta.type in ${filePath}`);
    return false;
  }

  if (type !== 'human' && type !== 'ai') {
    log('error', `Invalid _meta.type in ${filePath}: "${type}" (must be "human" or "ai")`);
    return false;
  }

  if (!version) {
    log('error', `Missing _meta.version in ${filePath}`);
    return false;
  }

  return true;
}

function validateFileSize(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    log(
      'error',
      `File size exceeds limit in ${filePath}: ${stats.size} bytes > ${MAX_FILE_SIZE} bytes`
    );
    return false;
  }
  return true;
}

function validateKeyCompleteness(enKeys, otherKeys, langPair) {
  const enKeySet = Object.keys(flattenKeys(enKeys));
  const otherKeySet = Object.keys(flattenKeys(otherKeys));

  const missingKeys = enKeySet.filter((key) => !otherKeySet.includes(key));
  const extraKeys = otherKeySet.filter((key) => !enKeySet.includes(key));

  if (missingKeys.length > 0) {
    log(
      'warn',
      `Missing keys in ${langPair}: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? ` ... and ${missingKeys.length - 5} more` : ''}`
    );
    return false;
  }

  if (extraKeys.length > 0) {
    log(
      'info',
      `Extra keys in ${langPair}: ${extraKeys.slice(0, 3).join(', ')}${extraKeys.length > 3 ? ` ... and ${extraKeys.length - 3} more` : ''}`
    );
  }

  return true;
}

function flattenKeys(obj, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === '_meta') continue; // Skip metadata

    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenKeys(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

function main() {
  log('info', 'Starting translation validation...');

  // Check if locales directory exists
  if (!fs.existsSync(LOCALES_DIR)) {
    log('error', `Locales directory not found: ${LOCALES_DIR}`);
    process.exit(1);
  }

  // Load English translations (reference)
  const enTranslations = {};
  for (const ns of REQUIRED_NAMESPACES) {
    const filePath = path.join(LOCALES_DIR, 'en', `${ns}.json`);

    if (!fs.existsSync(filePath)) {
      log('error', `Missing required file: ${filePath}`);
      continue;
    }

    log('info', `Validating ${filePath}`);

    // Check file size
    if (!validateFileSize(filePath)) continue;

    // Check JSON syntax
    const data = validateJSON(filePath);
    if (!data) continue;

    // Check _meta
    if (!validateMeta(data, filePath)) continue;

    enTranslations[ns] = data;
    log('success', `${filePath} is valid`);
  }

  // Validate other languages
  const allLanguages = [...REQUIRED_LANGUAGES, ...OPTIONAL_LANGUAGES];
  for (const lang of allLanguages) {
    if (lang === 'en') continue; // Skip English (already validated)

    const langDir = path.join(LOCALES_DIR, lang);
    if (!fs.existsSync(langDir)) {
      log('warn', `Language directory not found: ${langDir}`);
      continue;
    }

    for (const ns of REQUIRED_NAMESPACES) {
      const filePath = path.join(langDir, `${ns}.json`);

      if (!fs.existsSync(filePath)) {
        log('warn', `Missing optional file: ${filePath}`);
        continue;
      }

      log('info', `Validating ${filePath}`);

      // Check file size
      if (!validateFileSize(filePath)) continue;

      // Check JSON syntax
      const data = validateJSON(filePath);
      if (!data) continue;

      // Check _meta
      if (!validateMeta(data, filePath)) continue;

      // Check key completeness
      if (enTranslations[ns]) {
        validateKeyCompleteness(enTranslations[ns], data, `${lang}/${ns}`);
      }

      log('success', `${filePath} is valid`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (errorCount === 0) {
    log('success', `Translation validation passed! (${warningCount} warnings)`);
    process.exit(0);
  } else {
    log('error', `Translation validation failed! (${errorCount} errors, ${warningCount} warnings)`);
    process.exit(1);
  }
}

main();
