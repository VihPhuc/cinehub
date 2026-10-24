import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GlobalThrottlerGuard extends ThrottlerGuard {
  protected generateKey(
    _context: ExecutionContext,
    tracker: string,
    throttlerName: string
  ): string {
    return `${throttlerName}:${tracker}`;
  }
}
