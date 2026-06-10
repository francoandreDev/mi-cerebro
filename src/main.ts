// why: isomorphic-git relies on Node's Buffer global. Browsers don't
//      ship one, so we polyfill before any module that might import
//      it. Must run before bootstrapApplication.
import { Buffer } from 'buffer';
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  console.error(err);
});
