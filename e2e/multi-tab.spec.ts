/**
 * 画面動作テスト: マルチブラウザタブ対応
 * - 別タブで session.created イベントを受信してセッションが反映される
 * - 別タブで session.deleted イベントを受信してセッションが削除される
 */
import { test, expect } from '@playwright/test';

test.describe('マルチブラウザタブ', () => {
  test('page1 でセッション作成 → page2 にセッションが反映される', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      await page1.goto('/');
      await page2.goto('/');
      await page1.waitForLoadState('networkidle');
      await page2.waitForLoadState('networkidle');

      // page1 で新規セッション作成
      await page1.getByRole('button', { name: /new/i }).first().click();
      await expect(page1.getByRole('tab')).toHaveCount(1, { timeout: 5000 });

      // page2 にも session.created イベントが届く
      await expect(page2.getByRole('tab')).toHaveCount(1, { timeout: 5000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

  test('page1 でセッション削除 → page2 からセッションが消える', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      await page1.goto('/');
      await page2.goto('/');
      await page1.waitForLoadState('networkidle');
      await page2.waitForLoadState('networkidle');

      // Create session in page1
      await page1.getByRole('button', { name: /new/i }).first().click();
      await expect(page1.getByRole('tab')).toHaveCount(1, { timeout: 5000 });
      await expect(page2.getByRole('tab')).toHaveCount(1, { timeout: 5000 });

      // Delete session from page1
      const tab = page1.getByRole('tab').first();
      await tab.hover();
      await page1.getByRole('button', { name: /delete session/i }).click();

      await expect(page1.getByRole('tab')).toHaveCount(0, { timeout: 5000 });
      // page2 should also reflect the deletion
      await expect(page2.getByRole('tab')).toHaveCount(0, { timeout: 5000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
