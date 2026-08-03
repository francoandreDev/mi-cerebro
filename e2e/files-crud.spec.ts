import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test.beforeEach(async ({ page }) => {
  await enableE2eFs(page);
  await page.goto('/');
  await completeOnboarding(page);
  await page.getByRole('button', { name: 'Archivos' }).click();
  // why: /files auto-starts its own tutorial the first time it's visited in
  //      a session — blind-Escape dismiss, same as the other entity screens.
  await page.keyboard.press('Escape');
});

test('create, rename and delete a file collection', async ({ page }) => {
  await page.getByRole('button', { name: 'Nueva colección' }).first().click();
  await expect(page).toHaveURL(/\/files\/.+/);

  const titleInput = page.getByRole('textbox', { name: 'Nombre de la colección...' });
  await expect(titleInput).toBeVisible();
  await titleInput.fill('Colección de prueba e2e');
  await expect(titleInput).toHaveValue('Colección de prueba e2e');

  await page.getByRole('button', { name: '⋯' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar colección' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, mover' }).click();

  await expect(page).toHaveURL(/\/files$/);
});
