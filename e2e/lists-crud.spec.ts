import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test.beforeEach(async ({ page }) => {
  await enableE2eFs(page);
  await page.goto('/');
  await completeOnboarding(page);
  await page.getByRole('button', { name: 'Listas' }).click();
  // why: /lists auto-starts its own tutorial the first time it's visited in
  //      a session — blind-Escape dismiss, same as the other entity screens.
  await page.keyboard.press('Escape');
});

test('create, rename and delete a list', async ({ page }) => {
  await page.getByPlaceholder('Nueva lista...').fill('Lista e2e');
  await page.getByRole('button', { name: 'Crear lista' }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const titleInput = page.getByRole('textbox', { name: 'Título...' });
  await expect(titleInput).toHaveValue('Lista e2e');
  await titleInput.fill('Lista de prueba e2e');
  await expect(titleInput).toHaveValue('Lista de prueba e2e');

  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, mover' }).click();

  await expect(page).toHaveURL(/\/lists$/);
  await expect(page.getByRole('article', { name: /Lista de prueba e2e/ })).toHaveCount(0);
});
