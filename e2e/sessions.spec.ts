/**
 * 画面動作テスト: セッション管理
 * - セッション作成（ボタン・ショートカット）
 * - セッション一覧表示
 * - セッション切替
 * - セッション削除
 * - セッションリネーム
 */
import { test, expect } from '@playwright/test';

test.describe('セッション管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('「+ New」ボタンでセッションを作成できる', async ({ page }) => {
    await page.getByRole('button', { name: /new/i }).first().click();
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 5000 });
    // Verify tab shows session name
    const tab = page.getByRole('tab').first();
    await expect(tab).toContainText('Session');
  });

  test('Ctrl+Shift+N でセッションを作成できる', async ({ page }) => {
    await page.keyboard.press('Control+Shift+N');
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab').first()).toContainText('Session');
  });

  test('複数セッションを作成してサイドバーに一覧表示される', async ({ page }) => {
    // Create 3 sessions
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /new/i }).first().click();
      await page.waitForTimeout(300);
    }
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3, { timeout: 5000 });
  });

  test('タブをクリックでセッションを切り替えられる', async ({ page }) => {
    // Create 2 sessions
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.waitForTimeout(300);

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(2, { timeout: 5000 });

    // Click first tab
    await tabs.first().click();
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'false');

    // Click second tab
    await tabs.last().click();
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'false');
  });

  test('Alt+1/Alt+2 でセッションを切り替えられる', async ({ page }) => {
    // Create 2 sessions
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.waitForTimeout(300);

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(2, { timeout: 5000 });

    // Switch to first via Alt+1
    await page.keyboard.press('Alt+1');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

    // Switch to second via Alt+2
    await page.keyboard.press('Alt+2');
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
  });

  test('削除ボタンでセッションを削除できる', async ({ page }) => {
    await page.getByRole('button', { name: /new/i }).first().click();
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 5000 });

    // Hover to reveal delete button
    const tab = page.getByRole('tab').first();
    await tab.hover();
    const deleteBtn = page.getByRole('button', { name: /delete session/i });
    await deleteBtn.click();

    // Tab should be gone
    await expect(page.getByRole('tab')).toHaveCount(0, { timeout: 5000 });
  });

  test('Ctrl+Shift+W でアクティブセッションを削除できる', async ({ page }) => {
    await page.getByRole('button', { name: /new/i }).first().click();
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Control+Shift+W');
    await expect(page.getByRole('tab')).toHaveCount(0, { timeout: 5000 });
  });

  test('ダブルクリックでセッション名をリネームできる', async ({ page }) => {
    await page.getByRole('button', { name: /new/i }).first().click();
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 5000 });

    const tab = page.getByRole('tab').first();
    await tab.dblclick();

    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();
    await input.fill('My Custom Session');
    await input.press('Enter');

    await expect(tab).toContainText('My Custom Session', { timeout: 3000 });
  });
});
