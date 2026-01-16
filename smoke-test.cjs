#!/usr/bin/env node
/**
 * Smoke Test Script for dIKtate MVP
 *
 * Verifies that the development environment is properly set up
 * before running the application or starting manual testing.
 *
 * Run: node smoke-test.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bold}${msg}${colors.reset}`)
};

let passCount = 0;
let failCount = 0;
let warnCount = 0;

function check(name, testFn) {
  try {
    const result = testFn();
    if (result === true) {
      log.success(name);
      passCount++;
      return true;
    } else if (result === 'warn') {
      log.warn(name);
      warnCount++;
      return 'warn';
    } else {
      log.error(name);
      failCount++;
      return false;
    }
  } catch (error) {
    log.error(`${name} - ${error.message}`);
    failCount++;
    return false;
  }
}

console.log(`${colors.bold}
╔═══════════════════════════════════════════════════════╗
║         dIKtate MVP - Smoke Test Suite              ║
║              Environment Verification                ║
╚═══════════════════════════════════════════════════════╝
${colors.reset}`);

// Test 1: Project Structure
log.section('1. Project Structure');

check('package.json exists', () => fs.existsSync('package.json'));
check('tsconfig.json exists', () => fs.existsSync('tsconfig.json'));
check('src/main.ts exists', () => fs.existsSync('src/main.ts'));
check('src/services/pythonManager.ts exists', () => fs.existsSync('src/services/pythonManager.ts'));
check('src/utils/logger.ts exists', () => fs.existsSync('src/utils/logger.ts'));
check('src/utils/performanceMetrics.ts exists', () => fs.existsSync('src/utils/performanceMetrics.ts'));

// Test 2: Python Structure
log.section('2. Python Backend');

check('python/ipc_server.py exists', () => fs.existsSync('python/ipc_server.py'));
check('python/core/recorder.py exists', () => fs.existsSync('python/core/recorder.py'));
check('python/core/transcriber.py exists', () => fs.existsSync('python/core/transcriber.py'));
check('python/core/processor.py exists', () => fs.existsSync('python/core/processor.py'));
check('python/core/injector.py exists', () => fs.existsSync('python/core/injector.py'));
check('python/requirements.txt exists', () => fs.existsSync('python/requirements.txt'));
check('python/venv directory exists', () => fs.existsSync('python/venv'));

// Test 3: TypeScript Compilation
log.section('3. TypeScript Compilation');

check('TypeScript compiles without errors', () => {
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch (error) {
    return false;
  }
});

check('dist/ directory exists', () => {
  const exists = fs.existsSync('dist');
  if (!exists) {
    log.info('  Run "npx tsc" to compile TypeScript files');
  }
  return exists;
});

// Test 4: Node Dependencies
log.section('4. Node.js Dependencies');

check('node_modules exists', () => {
  const exists = fs.existsSync('node_modules');
  if (!exists) {
    log.info('  Run "npm install" to install dependencies');
  }
  return exists;
});

// Test 5: Python Virtual Environment
log.section('5. Python Virtual Environment');

const pythonExe = process.platform === 'win32'
  ? 'python/venv/Scripts/python.exe'
  : 'python/venv/bin/python';

check('Python executable exists in venv', () => fs.existsSync(pythonExe));

check('Python version is 3.11+', () => {
  if (!fs.existsSync(pythonExe)) return false;
  try {
    const version = execSync(`"${pythonExe}" --version`, { encoding: 'utf8' });
    const match = version.match(/Python (\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1]);
      const minor = parseInt(match[2]);
      return major >= 3 && minor >= 11;
    }
    return false;
  } catch {
    return false;
  }
});

// Test 6: Python Dependencies (basic check)
log.section('6. Python Dependencies');

check('Can import core modules', () => {
  if (!fs.existsSync(pythonExe)) return false;
  try {
    const script = 'import sys; sys.path.insert(0, "python"); from core import recorder, transcriber, processor, injector; print("OK")';
    const result = execSync(`"${pythonExe}" -c "${script}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result.includes('OK');
  } catch (error) {
    log.info('  Run "python/venv/Scripts/activate" and "pip install -r python/requirements.txt"');
    return 'warn';
  }
});

// Test 7: External Dependencies
log.section('7. External Dependencies');

check('Ollama is installed', () => {
  try {
    execSync('ollama --version', { stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch {
    log.info('  Install Ollama from https://ollama.com/');
    return 'warn';
  }
});

check('Ollama service is running', () => {
  try {
    execSync('ollama list', { stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch {
    log.info('  Start Ollama service or run "ollama serve"');
    return 'warn';
  }
});

check('llama3 model is available', () => {
  try {
    const output = execSync('ollama list', { encoding: 'utf8', stdio: 'pipe' });
    if (output.includes('llama3')) {
      return true;
    } else {
      log.info('  Run "ollama pull llama3" to download the model');
      return 'warn';
    }
  } catch {
    return 'warn';
  }
});

// Test 8: Log Directories
log.section('8. Log Directories');

const appDataPath = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
const electronLogPath = path.join(appDataPath, 'diktate', 'logs');
const pythonLogPath = path.join(process.env.USERPROFILE, '.diktate', 'logs');

check('Electron log directory path valid', () => {
  // Just check if APPDATA is accessible
  return fs.existsSync(appDataPath);
});

check('Python log directory path valid', () => {
  // Just check if home directory is accessible
  return fs.existsSync(process.env.USERPROFILE || process.env.HOME);
});

// Test 9: Assets
log.section('9. Assets');

check('assets/ directory exists', () => {
  const exists = fs.existsSync('assets');
  if (!exists) {
    log.warn('  Tray icons might be missing');
  }
  return exists ? true : 'warn';
});

// Summary
log.section('Test Summary');

const total = passCount + failCount + warnCount;
console.log(`
  ${colors.green}Passed:  ${passCount}/${total}${colors.reset}
  ${colors.red}Failed:  ${failCount}/${total}${colors.reset}
  ${colors.yellow}Warnings: ${warnCount}/${total}${colors.reset}
`);

if (failCount === 0 && warnCount === 0) {
  log.success('All checks passed! ✨');
  log.info('You can now run: npm run dev');
  process.exit(0);
} else if (failCount === 0) {
  log.warn('Some optional checks failed, but core functionality should work');
  log.info('You can proceed with: npm run dev');
  process.exit(0);
} else {
  log.error('Critical checks failed. Please fix the issues above before running the application.');
  log.info('See PHASE_3_TESTING_GUIDE.md for setup instructions');
  process.exit(1);
}
