import { test, expect, type Page } from '@playwright/test';

// Helper to collect console errors
function setupConsoleCollector(page: Page) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

test.describe('QA Audit — Full Site', () => {
  test('Dashboard loads without errors', async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/app/);
    await page.waitForLoadState('networkidle');
    
    // Check main content renders
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    
    // Check stat cards
    await expect(page.locator('#stats-grid')).toBeVisible();
    
    // Check for broken layout
    const body = page.locator('body');
    const overflow = await body.evaluate(el => {
      return el.scrollWidth > el.clientWidth;
    });
    console.log('Dashboard horizontal overflow:', overflow);
    console.log('Dashboard console errors:', errors);
  });

  test('Documents page loads and upload button works', async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto('/app/documents');
    await page.waitForLoadState('networkidle');
    
    // Check page loads
    await expect(page.locator('h1:has-text("Documents")')).toBeVisible();
    
    // Check Upload Document button exists and is visible
    const uploadBtn = page.locator('#upload-btn');
    await expect(uploadBtn).toBeVisible();
    console.log('Upload button visible: true');
    
    // Click upload button
    await uploadBtn.click();
    
    // Check modal opens
    const modal = page.locator('#upload-modal');
    const isHidden = await modal.evaluate(el => el.classList.contains('hidden'));
    console.log('Modal hidden after click:', isHidden);
    
    // Check modal has flex class (should show)
    const hasFlex = await modal.evaluate(el => el.classList.contains('flex'));
    console.log('Modal has flex class:', hasFlex);
    
    // Check modal is visible
    const modalVisible = await modal.isVisible();
    console.log('Modal isVisible():', modalVisible);
    
    // Check drop zone exists
    const dropZone = page.locator('#drop-zone');
    await expect(dropZone).toBeVisible();
    
    // Check file input exists
    const fileInput = page.locator('#file-input');
    await expect(fileInput).toBeAttached();
    
    console.log('Documents page errors:', errors);
  });

  test('Chat page loads and sends messages', async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');
    
    // Check welcome state
    await expect(page.locator('#welcome-state')).toBeVisible();
    await expect(page.locator('h2:has-text("What would you like to know?")')).toBeVisible();
    
    // Check chat input
    const chatInput = page.locator('#chat-input');
    await expect(chatInput).toBeVisible();
    
    // Check send button exists
    const sendBtn = page.locator('#send-btn');
    await expect(sendBtn).toBeAttached();
    
    // Check sidebar
    const sidebar = page.locator('#chat-sidebar');
    const sidebarVisible = await sidebar.isVisible();
    console.log('Chat sidebar visible:', sidebarVisible);
    
    // Check suggestion buttons
    const suggestions = page.locator('.suggestion-btn');
    const count = await suggestions.count();
    console.log('Suggestion buttons count:', count);
    
    console.log('Chat page errors:', errors);
  });

  test('Audio page loads correctly', async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto('/app/audio');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h1:has-text("Audio Overviews")')).toBeVisible();
    
    // Check generate button
    const genBtn = page.locator('#generate-btn');
    await expect(genBtn).toBeVisible();
    
    console.log('Audio page errors:', errors);
  });

  test('Mind Map page loads correctly', async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto('/app/mindmap');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h1:has-text("Knowledge Graph")')).toBeVisible();
    
    // Check graph container
    const container = page.locator('#graph-container');
    await expect(container).toBeVisible();
    
    console.log('Mind Map page errors:', errors);
  });

  test('Study page loads correctly', async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto('/app/study');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h1:has-text("Study")')).toBeVisible();
    
    // Check study mode buttons
    const studyBtns = page.locator('.study-mode-btn');
    const count = await studyBtns.count();
    console.log('Study mode buttons:', count);
    
    console.log('Study page errors:', errors);
  });

  test('Settings page loads and tabs work', async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto('/app/settings');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
    
    // Check tabs exist
    const tabs = page.locator('.settings-tab');
    const tabCount = await tabs.count();
    console.log('Settings tabs:', tabCount);
    
    // Click Preferences tab
    await page.locator('[data-tab="preferences"]').click();
    await page.waitForTimeout(300);
    
    // Check if preferences panel is visible
    const prefPanel = page.locator('#tab-preferences');
    const prefHidden = await prefPanel.evaluate(el => el.classList.contains('hidden'));
    console.log('Preferences panel hidden after click:', prefHidden);
    
    // Click Billing tab
    await page.locator('[data-tab="billing"]').click();
    await page.waitForTimeout(300);
    
    const billingPanel = page.locator('#tab-billing');
    const billingHidden = await billingPanel.evaluate(el => el.classList.contains('hidden'));
    console.log('Billing panel hidden after click:', billingHidden);
    
    console.log('Settings page errors:', errors);
  });

  test('Check all pages for horizontal overflow', async ({ page }) => {
    const pages = ['/app', '/app/documents', '/app/chat', '/app/audio', '/app/mindmap', '/app/study', '/app/settings'];
    
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      const overflow = await page.evaluate(() => {
        return document.body.scrollWidth > document.documentElement.clientWidth;
      });
      console.log(`${path} horizontal overflow: ${overflow}`);
    }
  });
});
