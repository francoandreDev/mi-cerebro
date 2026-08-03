import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test.beforeEach(async ({ page }) => {
  await enableE2eFs(page);
  await page.goto('/');
  await completeOnboarding(page);
  await page.getByRole('button', { name: 'Notas' }).click();
});

test('create, rename and delete a note', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Crear nueva nota' }).fill('Nota e2e');
  await page.getByRole('button', { name: 'Imprimir nota' }).click();

  const slip = page.getByRole('article');
  await expect(slip).toBeVisible();
  await slip.click();
  await expect(page).toHaveURL(/\/notes\/.+/);

  const titleInput = page.getByRole('textbox', { name: 'Título...' });
  await expect(titleInput).toHaveValue('Nota e2e');
  await titleInput.fill('Nota de prueba e2e');
  await expect(titleInput).toHaveValue('Nota de prueba e2e');

  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, mover' }).click();

  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByRole('article')).toHaveCount(0);
});
