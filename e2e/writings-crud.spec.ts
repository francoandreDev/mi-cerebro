import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test.beforeEach(async ({ page }) => {
  await enableE2eFs(page);
  await page.goto('/');
  await completeOnboarding(page);
  await page.getByRole('button', { name: 'Escritos' }).click();
  // why: /writings auto-starts its own tutorial the first time it's visited
  //      in a session — blind-Escape dismiss, same as the other entity
  //      screens.
  await page.keyboard.press('Escape');
});

test('create, rename and delete a writing', async ({ page }) => {
  await page.getByPlaceholder('Nuevo escrito.').fill('Escrito e2e');
  await page.getByRole('button', { name: 'Crear escrito' }).click();
  await expect(page).toHaveURL(/\/writings\/.+/);

  const titleInput = page.getByRole('textbox', { name: 'Título...' });
  await expect(titleInput).toHaveValue('Escrito e2e');
  await titleInput.fill('Escrito de prueba e2e');
  await expect(titleInput).toHaveValue('Escrito de prueba e2e');

  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, mover' }).click();

  await expect(page).toHaveURL(/\/writings$/);
  await expect(page.getByRole('button', { name: /Escrito de prueba e2e/ })).toHaveCount(0);
});
