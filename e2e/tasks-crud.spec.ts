import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test.beforeEach(async ({ page }) => {
  await enableE2eFs(page);
  await page.goto('/');
  await completeOnboarding(page);
  await page.getByRole('button', { name: 'Tareas' }).click();
  // why: /tasks auto-starts its own tutorial the first time it's visited in
  //      a session — blind-Escape dismiss, same as the other entity screens.
  await page.keyboard.press('Escape');
  // why: list view gives each task an accessible name = its title text,
  //      simpler to target than the garden's illustrated plant cards.
  await page.getByRole('button', { name: 'Ver como lista' }).click();
});

test('create, rename and delete a task', async ({ page }) => {
  await page.getByPlaceholder('¿Qué sembrás?').fill('Tarea e2e');
  await page.getByRole('button', { name: 'sembrar' }).click();

  const row = page.getByRole('button', { name: 'Tarea e2e' });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/\/tasks\/.+/);

  const titleInput = page.getByRole('textbox', { name: 'Título...' });
  await expect(titleInput).toHaveValue('Tarea e2e');
  await titleInput.fill('Tarea de prueba e2e');
  await expect(titleInput).toHaveValue('Tarea de prueba e2e');

  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, mover' }).click();

  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole('button', { name: 'Tarea de prueba e2e' })).toHaveCount(0);
});
