/// <reference types="astro/client" />

import type { User } from './lib/auth';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
    }
  }
}
