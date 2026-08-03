import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test.beforeEach(async ({ page }) => {
  await enableE2eFs(page);
  await page.goto('/');
  await completeOnboarding(page);
  await page.getByRole('button', { name: 'Metas' }).click();
  // why: /goals auto-starts its own tutorial the first time it's visited in
  //      a session (delayed enough that a lone test run can beat it, but not
  //      under full-suite parallel load) — same blind-Escape pattern as the
  //      other entity screens with their own tutorial.
  await page.keyboard.press('Escape');
});

test('create, rename and delete a goal', async ({ page }) => {
  await page.getByPlaceholder('¿Qué querés lograr?').fill('Meta e2e');
  await page.getByRole('button', { name: 'Crear meta' }).click();

  // why: list view gives each goal an accessible name = its title text,
  //      simpler to target than the wall's scattered stars.
  await page.getByRole('button', { name: 'Ver como lista' }).click();

  const row = page.getByRole('button', { name: 'Meta e2e' });
  await expect(row).toBeVisible();
  // why: opening the goal navigates to its editor, which auto-starts its own
  //      (constellation) tutorial on top of the wall's. That overlay can pop
  //      up mid-click and detach the row, so Playwright's click actionability
  //      retry gets stuck fighting it — bound the click attempt and confirm
  //      via the URL instead of trusting click() to resolve cleanly.
  await row.click({ timeout: 5000 }).catch(() => undefined);
  await expect(page).toHaveURL(/\/goals\/.+/);
  await page.keyboard.press('Escape');

  // why: the goal title is click-to-rename (a plain button until clicked,
  //      then it swaps for a text input) — unlike tasks/lists/writings/books,
  //      which show an always-editable title input.
  await page.getByRole('button', { name: 'Meta e2e' }).click();
  const titleInput = page.getByRole('textbox', { name: 'Título...' });
  await expect(titleInput).toHaveValue('Meta e2e');
  await titleInput.fill('Meta de prueba e2e');
  await titleInput.press('Tab');
  await expect(page.getByRole('button', { name: 'Meta de prueba e2e' })).toBeVisible();

  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, mover' }).click();

  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByRole('button', { name: 'Meta de prueba e2e' })).toHaveCount(0);
});
