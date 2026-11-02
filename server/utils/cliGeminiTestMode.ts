import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const PERMIT_TTL_MS = 60_000;
const TEST_TASK_FILE = path.join(process.cwd(), 'data', 'gemini_cli_test_tasks.json');

interface Permit {
  accountId: string;
  email: string;
  expiresAt: number;
}

interface TestTaskIdentity {
  accountId: string;
  email: string;
  createdAt: number;
}

const permits = new Map<string, Permit>();

function normalizeIdentity(accountId: string, email: string): Pick<Permit, 'accountId' | 'email'> {
  return { accountId: accountId.trim(), email: email.trim().toLowerCase() };
}

function readTestTasks(): Record<string, TestTaskIdentity> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(TEST_TASK_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('CLI Gemini test-task registry must be an object.');
    }
    return parsed as Record<string, TestTaskIdentity>;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return {};
    console.error('[CLI Gemini Test Mode] Could not read test-task registry:', error);
    throw error;
  }
}

function saveTestTasks(tasks: Record<string, TestTaskIdentity>): void {
  const directory = path.dirname(TEST_TASK_FILE);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = `${TEST_TASK_FILE}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(tasks, null, 2), 'utf8');
    fs.renameSync(temporaryPath, TEST_TASK_FILE);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch (cleanupError: any) {
      if (cleanupError?.code !== 'ENOENT') {
        console.error('[CLI Gemini Test Mode] Could not clean temporary test-task registry:', cleanupError);
      }
    }
    console.error('[CLI Gemini Test Mode] Could not save test-task registry:', error);
    throw error;
  }
}

export function issueCliGeminiTestPermit(accountId: string, email: string): string {
  const now = Date.now();
  for (const [token, permit] of permits) {
    if (permit.expiresAt <= now) permits.delete(token);
  }
  const token = crypto.randomBytes(32).toString('hex');
  permits.set(token, { ...normalizeIdentity(accountId, email), expiresAt: now + PERMIT_TTL_MS });
  return token;
}

export function consumeCliGeminiTestPermit(
  token: string,
  accountId: string,
  email: string,
): boolean {
  const permit = permits.get(token);
  if (!permit) return false;
  permits.delete(token);
  return permit.expiresAt > Date.now() &&
    permit.accountId === accountId.trim() &&
    permit.email === email.trim().toLowerCase();
}

export function recordCliGeminiTestTask(
  operationName: string,
  accountId: string,
  email: string,
): void {
  const tasks = readTestTasks();
  tasks[operationName] = {
    ...normalizeIdentity(accountId, email),
    createdAt: Date.now(),
  };
  saveTestTasks(tasks);
}

export function isCliGeminiTestTask(
  operationName: string,
  accountId: string,
  email: string,
): boolean {
  const task = readTestTasks()[operationName];
  if (!task) return false;
  const identity = normalizeIdentity(accountId, email);
  return task.accountId === identity.accountId && task.email === identity.email;
}
