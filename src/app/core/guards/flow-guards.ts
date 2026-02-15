import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DocumentEditor } from '../services/document-editor/document-editor';

export const requireFilesGuard: CanActivateFn = () => {
  const documentEditor = inject(DocumentEditor);
  const router = inject(Router);

  return documentEditor.hasFiles() ? true : router.parseUrl('/import');
};

export const requirePagesGuard: CanActivateFn = () => {
  const documentEditor = inject(DocumentEditor);
  const router = inject(Router);

  return documentEditor.hasPages() ? true : router.parseUrl('/files');
};
