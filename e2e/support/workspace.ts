import type { Page } from '@playwright/test';

// why: sets the flag native-fs.providers.ts checks before the app boots
//      (must land before any app script runs, hence addInitScript rather
//      than page.evaluate after navigation) so WorkspaceService resolves
//      E2eNativeFs instead of BrowserNativeFs — there is no way to drive
//      the real showDirectoryPicker() dialog from Playwright.
export async function enableE2eFs(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __E2E_FS__: boolean }).__E2E_FS__ = true;
  });
}

// why: onboarding's "Elegir carpeta" click resolves instantly against the
//      in-memory adapter (no real dialog), but the app still runs its full
//      adopt/init-structure sequence async — waiting for the sidebar rail
//      (only rendered once WorkspaceService.isReady()) is the one DOM
//      signal that's true only after that sequence finishes. Assumes the
//      caller already navigated (goto('/')) — this only clicks through,
//      it doesn't (re)load the page, so the in-memory fs tree from an
//      earlier goto in the same test isn't discarded by a second reload.
export async function completeOnboarding(page: Page): Promise<void> {
  const chooseButton = page.getByRole('button', { name: 'Elegir carpeta' });
  if (await chooseButton.isVisible().catch(() => false)) {
    await chooseButton.click();
  }
  await page.locator('mc-workspace-sidebar .rail').waitFor({ state: 'visible' });
  // why: Command Palette's tutorial has `autoStartIfUnseen: true` (fires
  //      the first time the app opens, per docs/sistema/tutoriales-atajos.md)
  //      — a fresh e2e session hits this every time. Escape always closes
  //      the overlay (§4.13 accessibility rule), so it's a safe blind
  //      dismiss even when the dialog wasn't shown (no-op then).
  await page.keyboard.press('Escape');
}
