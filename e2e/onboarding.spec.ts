import { test, expect } from '@playwright/test';

import { completeOnboarding, enableE2eFs } from './support/workspace';

test('onboarding: fresh session shows the welcome card, then lands on the app shell', async ({
  page,
}) => {
  await enableE2eFs(page);
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Elegir carpeta' })).toBeVisible();

  await completeOnboarding(page);

  await expect(page.getByRole('button', { name: 'Notas' })).toBeVisible();
});
