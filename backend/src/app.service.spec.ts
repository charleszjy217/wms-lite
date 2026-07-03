import { describe, it, expect } from 'vitest';
import { AppService } from './app.service';

describe('AppService', () => {
  it('should return greeting', () => {
    const service = new AppService();
    expect(service.getHello()).toBe('WMS-lite Backend');
  });
});
