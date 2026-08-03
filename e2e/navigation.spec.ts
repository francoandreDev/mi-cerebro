import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test.beforeEach(async ({ page }) => {
  await enableE2eFs(page);
  await page.goto('/');
  await completeOnboarding(page);
});

test('sidebar rail navigates across sections', async ({ page }) => {
  await page.getByRole('button', { name: 'Notas' }).click();
  await expect(page).toHaveURL(/\/notes/);

  await page.getByRole('button', { name: 'Tareas' }).click();
  await expect(page).toHaveURL(/\/tasks/);

  await page.getByRole('button', { name: 'Metas' }).click();
  await expect(page).toHaveURL(/\/goals/);

  await page.getByRole('button', { name: 'Calendario' }).click();
  await expect(page).toHaveURL(/\/calendar/);
});
