import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test.beforeEach(async ({ page }) => {
  await enableE2eFs(page);
  await page.goto('/');
  await completeOnboarding(page);
  await page.getByRole('button', { name: 'Libros' }).click();
  // why: /books auto-starts its own tutorial the first time it's visited in
  //      a session, on top of the command palette one completeOnboarding
  //      already dismissed — same blind-Escape pattern.
  await page.keyboard.press('Escape');
});

test('create, rename and delete a book', async ({ page }) => {
  await page.getByRole('button', { name: 'Nuevo libro' }).click();
  await expect(page).toHaveURL(/\/books\/.+/);

  const titleInput = page.getByRole('textbox', { name: 'Título del libro...' });
  await expect(titleInput).toBeVisible();
  await titleInput.fill('Libro de prueba e2e');
  await expect(titleInput).toHaveValue('Libro de prueba e2e');

  await page.getByRole('button', { name: '⋯' }).click();
  await page.getByRole('menuitem', { name: 'Mover a papelera' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, mover' }).click();

  await expect(page).toHaveURL(/\/books$/);
});
