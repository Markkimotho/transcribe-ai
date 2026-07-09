# services/meeting-bot contract

Phase 4 calendar bot seam.

- Calendar OAuth and platform-specific join adapters provide scheduled meeting invites.
- The bot state machine is deterministic: invited -> joined -> recording -> left/failed.
- Server-side audio capture hands completed recordings to `services/jobs`.
- Live platform joins require provider credentials and staging meetings.
