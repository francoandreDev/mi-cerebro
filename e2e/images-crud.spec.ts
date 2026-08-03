import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test.beforeEach(async ({ page }) => {
  await enableE2eFs(page);
  await page.goto('/');
  await completeOnboarding(page);
  await page.getByRole('button', { name: 'Imágenes' }).click();
  // why: /images auto-starts its own tutorial the first time it's visited
  //      in a session, same blind-Escape pattern as other entity screens.
  await page.keyboard.press('Escape');
});

test('create, rename and delete a gallery', async ({ page }) => {
  await page.getByRole('button', { name: 'Nueva galería' }).first().click();
  await expect(page).toHaveURL(/\/images\/.+/);

  const titleInput = page.getByRole('textbox', { name: 'Nombre de la galería...' });
  await expect(titleInput).toBeVisible();
  await titleInput.fill('Galería de prueba e2e');
  await expect(titleInput).toHaveValue('Galería de prueba e2e');

  await page.getByRole('button', { name: '⋯' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar galería' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, mover' }).click();

  await expect(page).toHaveURL(/\/images$/);
});
