import { Global, Module } from '@nestjs/common';
import { UsageTrackerService } from './usage-tracker.service';

@Global()  // Add this decorator
@Module({
    providers: [UsageTrackerService],
    exports: [UsageTrackerService]
})
export class UsageTrackerModule { }