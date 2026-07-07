import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { BrowserNativeFs } from './core/fs/adapters/browser-native-fs';
import { NATIVE_FS } from './core/fs/native-fs';

describe('App', () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase('mc-fs');
    indexedDB.deleteDatabase('mc-app');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: NATIVE_FS, useClass: BrowserNativeFs }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
