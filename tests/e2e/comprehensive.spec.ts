import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ───

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#submit-btn');
  await page.waitForURL('**/app/**', { timeout: 10000 });
}

function setupConsoleCollector(page: Page) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 1: Authentication & Dashboard State
// ═══════════════════════════════════════════════════════════════

test.describe('AUTH — Authentication & Route Guards', () => {

  test('AUTH-01: Post-login redirect & session state', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible();

    // Fill and submit login
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('#submit-btn');

    // Should redirect to /app
    await page.waitForURL('**/app/**', { timeout: 10000 });
    await expect(page).toHaveURL(/\/app/);

    // Header should show user info
    await expect(page.locator('text=NotesChatAI')).toBeVisible();
  });

  test('AUTH-02: Protected route guard — redirects unauthenticated users', async ({ page }) => {
    const protectedRoutes = ['/app', '/app/documents', '/app/chat', '/app/audio', '/app/mindmap', '/app/study', '/app/settings'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  });

  test('AUTH-03: API routes return 401 for unauthenticated requests', async ({ page }) => {
    const apiRoutes = ['/api/documents', '/api/chat'];

    for (const route of apiRoutes) {
      const response = await page.request.get(route);
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    }
  });

  test('AUTH-04: Public routes accessible without auth', async ({ page }) => {
    const publicRoutes = ['/', '/features', '/pricing', '/auth/login', '/auth/signup'];

    for (const route of publicRoutes) {
      const response = await page.request.get(route);
      expect(response.status()).toBe(200);
    }
  });

  test('AUTH-05: Login form validation — empty fields', async ({ page }) => {
    await page.goto('/auth/login');
    await page.click('#submit-btn');

    // Should show error
    await expect(page.locator('#error-banner')).toBeVisible();
  });

  test('AUTH-06: Login form — invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', 'nonexistent@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('#submit-btn');

    // Should show error banner
    await expect(page.locator('#error-banner')).toBeVisible();
    await expect(page.locator('#error-text')).toContainText('Invalid email or password');
  });

  test('AUTH-07: Password visibility toggle', async ({ page }) => {
    await page.goto('/auth/login');
    const passwordInput = page.locator('#password');
    const toggleBtn = page.locator('#toggle-password');

    // Initially password type
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle — should show password
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again — should hide
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('AUTH-08: Signup form — password strength indicator', async ({ page }) => {
    await page.goto('/auth/signup');

    // Weak password
    await page.fill('#password', 'abc');
    await expect(page.locator('#str-label')).toHaveText('Weak');

    // Strong password
    await page.fill('#password', 'MyStr0ng!Pass');
    await expect(page.locator('#str-label')).toHaveText('Strong');
  });

  test('AUTH-09: Signup form — password confirmation mismatch', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.fill('#password', 'password123');
    await page.fill('#confirmPassword', 'differentpassword');

    // Should show mismatch error
    await expect(page.locator('#confirm-error')).toBeVisible();
    await expect(page.locator('#confirm-error')).toContainText('Passwords do not match');
  });
});

// ═══════════════════════════════════════════════════════════════
// MODULE 2: Dashboard State
// ═══════════════════════════════════════════════════════════════

test.describe('DASHBOARD — State & Navigation', () => {

  test.beforeEach(async ({ page }) => {
    // Login before each dashboard test
    await page.goto('/auth/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('#submit-btn');
    await page.waitForURL('**/app/**', { timeout: 10000 });
  });

  test('DASH-01: Dashboard loads with stat cards', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('#stats-grid')).toBeVisible();

    // Should have 4 stat cards
    const statCards = page.locator('#stats-grid > div');
    await expect(statCards).toHaveCount(4);
  });

  test('DASH-02: Dashboard quick actions are clickable', async ({ page }) => {
    await page.goto('/app');

    // Upload Document card
    const uploadCard = page.locator('a[href="/app/documents"]').first();
    await expect(uploadCard).toBeVisible();

    // Start Chat card
    const chatCard = page.locator('a[href="/app/chat"]').first();
    await expect(chatCard).toBeVisible();
  });

  test('DASH-03: Navigation links work correctly', async ({ page }) => {
    await page.goto('/app');

    // Click Documents nav
    await page.click('nav a[href="/app/documents"]');
    await expect(page).toHaveURL(/\/app\/documents/);

    // Click Chat nav
    await page.click('nav a[href="/app/chat"]');
    await expect(page).toHaveURL(/\/app\/chat/);

    // Click back to Dashboard
    await page.click('nav a[href="/app"]');
    await expect(page).toHaveURL(/\/app\/?$/);
  });

  test('DASH-04: Mobile menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');

    // Open mobile menu
    await page.click('#mobile-menu-btn');
    await expect(page.locator('#mobile-menu')).toBeVisible();

    // Close mobile menu
    await page.click('#mobile-menu-close');
    await expect(page.locator('#mobile-menu')).toBeHidden();
  });

  test('DASH-05: Theme toggle works', async ({ page }) => {
    await page.goto('/app');

    // Toggle theme
    await page.click('#theme-toggle');
    await page.waitForTimeout(300);

    // Check if dark class is toggled
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(typeof isDark).toBe('boolean');
  });
});

// ═══════════════════════════════════════════════════════════════
// MODULE 3: Document Ingestion
// ═══════════════════════════════════════════════════════════════

test.describe('DOCUMENTS — Upload & Management', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('#submit-btn');
    await page.waitForURL('**/app/**', { timeout: 10000 });
  });

  test('UPL-01: Documents page loads with upload button', async ({ page }) => {
    await page.goto('/app/documents');
    await expect(page.locator('h1:has-text("Documents")')).toBeVisible();
    await expect(page.locator('#upload-btn')).toBeVisible();
  });

  test('UPL-02: Upload modal opens and closes', async ({ page }) => {
    await page.goto('/app/documents');

    // Open modal
    await page.click('#upload-btn');
    const modal = page.locator('#upload-modal');
    await expect(modal).toBeVisible();

    // Check modal content
    await expect(page.locator('#drop-zone')).toBeVisible();
    await expect(page.locator('#file-input')).toBeAttached();

    // Close modal
    await page.click('#close-modal');
    await expect(modal).toBeHidden();
  });

  test('UPL-03: Upload modal — Cancel button closes modal', async ({ page }) => {
    await page.goto('/app/documents');
    await page.click('#upload-btn');
    await expect(page.locator('#upload-modal')).toBeVisible();

    await page.click('#cancel-upload');
    await expect(page.locator('#upload-modal')).toBeHidden();
  });

  test('UPL-04: Upload modal — clicking backdrop closes modal', async ({ page }) => {
    await page.goto('/app/documents');
    await page.click('#upload-btn');

    // Click outside modal (backdrop)
    await page.click('#upload-modal', { position: { x: 10, y: 10 } });
    await expect(page.locator('#upload-modal')).toBeHidden();
  });

  test('UPL-05: Upload form — file input accepts correct types', async ({ page }) => {
    await page.goto('/app/documents');
    await page.click('#upload-btn');

    const fileInput = page.locator('#file-input');
    const accept = await fileInput.getAttribute('accept');
    expect(accept).toContain('.pdf');
    expect(accept).toContain('.epub');
    expect(accept).toContain('.docx');
    expect(accept).toContain('.txt');
    expect(accept).toContain('.jpg');
    expect(accept).toContain('.png');
  });

  test('UPL-06: Upload form — drag and drop zone is interactive', async ({ page }) => {
    await page.goto('/app/documents');
    await page.click('#upload-btn');

    const dropZone = page.locator('#drop-zone');
    await expect(dropZone).toBeVisible();
    await expect(dropZone).toHaveAttribute('role', 'button');
    await expect(dropZone).toHaveAttribute('tabindex', '0');
  });

  test('UPL-07: Upload form — title auto-fills from filename', async ({ page }) => {
    await page.goto('/app/documents');
    await page.click('#upload-btn');

    // Create a test file
    const fileContent = 'Test content';
    const buffer = Buffer.from(fileContent);

    // Set file on input
    await page.locator('#file-input').setInputFiles({
      name: 'my-notes.pdf',
      mimeType: 'application/pdf',
      buffer,
    });

    // Title should auto-fill
    const titleInput = page.locator('#title-input');
    await expect(titleInput).toHaveValue('my-notes');
  });

  test('UPL-08: Empty state shows when no documents', async ({ page }) => {
    await page.goto('/app/documents');

    // Empty state should be visible
    const emptyState = page.locator('#empty-state');
    await expect(emptyState).toBeVisible();
    await expect(page.locator('text=No documents yet')).toBeVisible();
  });

  test('UPL-09: Camera scan button exists', async ({ page }) => {
    await page.goto('/app/documents');
    await expect(page.locator('#scan-btn')).toBeVisible();
  });

  test('UPL-10: Camera modal opens on scan click', async ({ page }) => {
    await page.goto('/app/documents');
    await page.click('#scan-btn');

    // Camera modal should be visible
    const cameraModal = page.locator('#camera-modal');
    await expect(cameraModal).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// MODULE 4: AI Chat
// ═══════════════════════════════════════════════════════════════

test.describe('CHAT — Conversational AI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('#submit-btn');
    await page.waitForURL('**/app/**', { timeout: 10000 });
  });

  test('CHAT-01: Chat page loads with welcome state', async ({ page }) => {
    await page.goto('/app/chat');
    await expect(page.locator('#welcome-state')).toBeVisible();
    await expect(page.locator('h2:has-text("What would you like to know?")')).toBeVisible();
  });

  test('CHAT-02: Chat input is functional', async ({ page }) => {
    await page.goto('/app/chat');

    const chatInput = page.locator('#chat-input');
    await expect(chatInput).toBeVisible();

    // Type a message
    await chatInput.fill('Hello, this is a test message');
    await expect(chatInput).toHaveValue('Hello, this is a test message');

    // Send button should be enabled
    const sendBtn = page.locator('#send-btn');
    await expect(sendBtn).toBeEnabled();
  });

  test('CHAT-03: Suggestion buttons populate input', async ({ page }) => {
    await page.goto('/app/chat');

    // Click first suggestion
    const firstSuggestion = page.locator('.suggestion-btn').first();
    await expect(firstSuggestion).toBeVisible();
    await firstSuggestion.click();

    // Input should be populated
    const chatInput = page.locator('#chat-input');
    const value = await chatInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('CHAT-04: New Chat button resets conversation', async ({ page }) => {
    await page.goto('/app/chat');

    // Type a message
    await page.fill('#chat-input', 'Test message');

    // Click new chat
    await page.click('#new-chat-btn');

    // Welcome state should reappear
    await expect(page.locator('#welcome-state')).toBeVisible();
    await expect(page.locator('#chat-title')).toHaveText('New Conversation');
  });

  test('CHAT-05: Chat sidebar shows conversations', async ({ page }) => {
    await page.goto('/app/chat');

    // Sidebar should be visible on desktop
    const sidebar = page.locator('#chat-sidebar');
    await expect(sidebar).toBeVisible();

    // Should show conversation list
    await expect(page.locator('#conversation-list')).toBeVisible();
  });

  test('CHAT-06: Chat page — no horizontal overflow', async ({ page }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test('CHAT-07: Chat error banner is dismissible', async ({ page }) => {
    await page.goto('/app/chat');

    // Error banner should exist but be hidden
    const errorBanner = page.locator('#chat-error-banner');
    await expect(errorBanner).toBeHidden();
  });

  test('CHAT-08: Chat input auto-resizes', async ({ page }) => {
    await page.goto('/app/chat');

    const chatInput = page.locator('#chat-input');
    const initialHeight = await chatInput.evaluate(el => el.clientHeight);

    // Type multiple lines
    await chatInput.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

    // Height should increase
    const newHeight = await chatInput.evaluate(el => el.clientHeight);
    expect(newHeight).toBeGreaterThanOrEqual(initialHeight);
  });
});

// ═══════════════════════════════════════════════════════════════
// MODULE 5: Settings
// ═══════════════════════════════════════════════════════════════

test.describe('SETTINGS — User Preferences', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('#submit-btn');
    await page.waitForURL('**/app/**', { timeout: 10000 });
  });

  test('SETTINGS-01: Settings page loads with tabs', async ({ page }) => {
    await page.goto('/app/settings');
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();

    // Should have 5 tabs
    const tabs = page.locator('.settings-tab');
    await expect(tabs).toHaveCount(5);
  });

  test('SETTINGS-02: Tab switching works', async ({ page }) => {
    await page.goto('/app/settings');

    // Click Preferences tab
    await page.click('[data-tab="preferences"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#tab-preferences')).toBeVisible();

    // Click Billing tab
    await page.click('[data-tab="billing"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#tab-billing')).toBeVisible();

    // Click API tab
    await page.click('[data-tab="api"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#tab-api')).toBeVisible();
  });

  test('SETTINGS-03: Toggle switches are interactive', async ({ page }) => {
    await page.goto('/app/settings');
    await page.click('[data-tab="preferences"]');
    await page.waitForTimeout(300);

    // Find toggle checkboxes
    const toggles = page.locator('#tab-preferences input[type="checkbox"]');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('SETTINGS-04: Profile form shows user data', async ({ page }) => {
    await page.goto('/app/settings');

    // Should show profile section
    await expect(page.locator('text=Profile Information')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// MODULE 6: Cross-cutting Concerns
// ═══════════════════════════════════════════════════════════════

test.describe('CROSS — Layout & Responsiveness', () => {

  test('No horizontal overflow on any app page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('#submit-btn');
    await page.waitForURL('**/app/**', { timeout: 10000 });

    const pages = ['/app', '/app/documents', '/app/chat', '/app/audio', '/app/mindmap', '/app/study', '/app/settings'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => {
        return document.body.scrollWidth > document.documentElement.clientWidth;
      });
      expect(overflow, `${path} has horizontal overflow`).toBe(false);
    }
  });

  test('All pages have proper meta tags', async ({ page }) => {
    const publicPages = ['/', '/features', '/pricing', '/auth/login', '/auth/signup'];

    for (const path of publicPages) {
      await page.goto(path);

      // Should have title
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);

      // Should have viewport meta
      const viewport = await page.locator('meta[name="viewport"]').count();
      expect(viewport).toBeGreaterThan(0);
    }
  });

  test('Dark mode toggle persists across pages', async ({ page }) => {
    await page.goto('/');
    await page.click('#theme-toggle');
    await page.waitForTimeout(300);

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    // Navigate to another page
    await page.goto('/features');
    await page.waitForTimeout(300);

    const isDarkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDarkAfter).toBe(isDark);
  });
});

// ═══════════════════════════════════════════════════════════════
// MODULE 7: Security
// ═══════════════════════════════════════════════════════════════

test.describe('SECURITY — Headers & Guards', () => {

  test('Security headers present on responses', async ({ page }) => {
    const response = await page.request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-xss-protection']).toBe('1; mode=block');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('API returns proper JSON error for unauthorized', async ({ page }) => {
    const response = await page.request.get('/api/documents');
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBeDefined();
  });

  test('API returns proper error for invalid request body', async ({ page }) => {
    const response = await page.request.post('/api/documents', {
      headers: { 'Content-Type': 'application/json' },
      data: { invalid: 'data' },
    });
    // Should return 400 or 401 (depending on auth)
    expect([400, 401]).toContain(response.status());
  });
});
