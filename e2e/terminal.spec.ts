/**
 * 画面動作テスト: ターミナル
 * - xterm.js canvas レンダリング
 * - キー入力 → PTY 出力確認
 * - ターミナルサイズ fit
 */
import { test, expect } from '@playwright/test';

test.describe('ターミナル', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Create a session
    await page.getByRole('button', { name: /new/i }).first().click();
    // Wait for terminal to be ready
    await page.waitForTimeout(1500);
  });

  test('xterm.js の canvas がレンダリングされる', async ({ page }) => {
    const canvas = page.locator('canvas.xterm-text-layer').first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
  });

  test('キーボード入力が PTY に届き、出力が表示される', async ({ page }) => {
    // Click on terminal area to focus
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.waitForTimeout(300);

    // Type echo command with unique marker
    await page.keyboard.type('echo madori_test_marker_xyz');
    await page.keyboard.press('Enter');

    // Wait for output
    await expect(page.locator('.xterm-rows')).toContainText('madori_test_marker_xyz', {
      timeout: 8000,
    });
  });

  test('ターミナルが画面幅に合わせて表示される', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas.xterm-text-layer').first();
    const bbox = await canvas.boundingBox();
    expect(bbox).not.toBeNull();
    if (bbox) {
      // Canvas should be reasonably wide
      expect(bbox.width).toBeGreaterThan(400);
      expect(bbox.height).toBeGreaterThan(200);
    }
  });

  test('ウィンドウリサイズ後もターミナルが適切にフィットする', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas.xterm-text-layer').first();
    await expect(canvas).toBeVisible();
    const bbox = await canvas.boundingBox();
    expect(bbox).not.toBeNull();
    if (bbox) {
      expect(bbox.width).toBeGreaterThan(600);
    }
  });
});
