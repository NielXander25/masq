# Masq — Project Brief for Claude Code

Masq is a browser-based voice/video call platform where **the host is anonymous** and **every guest is identified**. The host picks any display name for each call and can disguise their voice. Guests must sign in with Google, so the host sees their real name and email. After each call, the host receives the audio recording and a speaker-labelled transcript. A platform admin can see all users, all calls, and the real account behind every anonymous host.

Owner: KING'SMIND LABS (KMLABS). Priority: get a working MVP live fast, then harden.

---

## Tech stack (use exactly this unless told otherwise)

- **Framework:** Next.js 15 (App Router), TypeScript (strict), Tailwind CSS
- **State:** Zustand (client call state only)
- **Auth:** Auth.js v5 with the Google provider only, Prisma adapter, database sessions
- **Database:** Neon Postgres via Prisma (use the Neon pooled URL for runtime and the direct URL for migrations)
- **Realtime media:** LiveKit (`livekit-server-sdk` on the server, `livekit-client` + `@livekit/components-react` on the client)
- **Recording:** LiveKit Egress → Cloudflare R2 (S3-compatible)
- **Transcription:** Deepgram pre-recorded API, behind a `Transcriber` interface so it can be swapped for self-hosted Whisper later
- **Email:** Resend (sends the "your recording is ready" email)
- **Hosting:** Vercel
- **Validation:** Zod on every API input

---

## Core rules (never break these)

1. **The host's identity never reaches any client except the admin dashboard.** No host email, name, user ID, or avatar in LiveKit tokens, room or participant metadata, API responses to guests, recording filenames, transcript labels, or HTML. The host's LiveKit identity is a random ID (e.g. `host_<nanoid>`) and its name is the alias.
2. **The host's voice is disguised before it leaves the device.** The raw microphone track is never published when the voice changer is on.
3. **The host's IP address is hidden.** Hosts connect with `rtcConfig: { iceTransportPolicy: 'relay' }` so all their media goes through TURN.
4. **Guests are identified.** A guest's LiveKit name is their Google name, and their participant metadata includes their email.
5. **Consent before entry.** Guests must tick a consent box ("The host is anonymous. They will see your name and email, and this call may be recorded and transcribed") before they can request to join. Store `consentedAt`.
6. **The host approves every guest.** Nobody gets a LiveKit token until the host admits them.
7. **Every admin view of a host's real identity, recording, or transcript writes an `AuditLog` row.**
8. All LiveKit tokens are issued server-side only, are short-lived (≤ 2 hours), and are scoped to one room.

---

## Data model (Prisma)

```prisma
enum Role { USER ADMIN }
enum Plan { FREE PRO }
enum CallStatus { SCHEDULED LIVE ENDED }
enum ParticipantStatus { PENDING ADMITTED DENIED LEFT }
enum RecordingKind { TRACK MIXED }
enum JobStatus { PENDING PROCESSING DONE FAILED }
enum ReportStatus { OPEN REVIEWED ACTIONED DISMISSED }

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String?
  image       String?
  role        Role     @default(USER)
  plan        Plan     @default(FREE)
  bannedAt    DateTime?
  lastSeenAt  DateTime?
  createdAt   DateTime @default(now())
  hostedCalls Call[]   @relation("HostCalls")
  participations Participant[]
  reports     Report[]
  // + Auth.js Account / Session relations
}

model Call {
  id                  String     @id @default(cuid())
  hostId              String
  host                User       @relation("HostCalls", fields: [hostId], references: [id])
  hostAlias           String     // 2–32 chars, set per call
  roomName            String     @unique
  status              CallStatus @default(SCHEDULED)
  voiceChangerEnabled Boolean    @default(false)
  voicePreset         String?
  recordingEnabled    Boolean    @default(false)
  startedAt           DateTime?
  endedAt             DateTime?
  createdAt           DateTime   @default(now())
  participants        Participant[]
  recordings          Recording[]
  transcript          Transcript?
  reports             Report[]
}

model Participant {
  id              String            @id @default(cuid())
  callId          String
  call            Call              @relation(fields: [callId], references: [id])
  userId          String
  user            User              @relation(fields: [userId], references: [id])
  isHost          Boolean           @default(false)
  livekitIdentity String            @unique
  status          ParticipantStatus @default(PENDING)
  consentedAt     DateTime?
  joinedAt        DateTime?
  leftAt          DateTime?
  recordings      Recording[]
  @@unique([callId, userId])
}

model Recording {
  id            String        @id @default(cuid())
  callId        String
  call          Call          @relation(fields: [callId], references: [id])
  participantId String?
  participant   Participant?  @relation(fields: [participantId], references: [id])
  kind          RecordingKind
  egressId      String        @unique
  fileKey       String?       // R2 object key, never contains host identity
  durationSec   Int?
  status        JobStatus     @default(PENDING)
  createdAt     DateTime      @default(now())
}

model Transcript {
  id        String    @id @default(cuid())
  callId    String    @unique
  call      Call      @relation(fields: [callId], references: [id])
  status    JobStatus @default(PENDING)
  segments  Json?     // [{ speakerLabel, startMs, endMs, text }]
  text      String?
  createdAt DateTime  @default(now())
}

model Report {
  id         String       @id @default(cuid())
  callId     String
  call       Call         @relation(fields: [callId], references: [id])
  reporterId String
  reporter   User         @relation(fields: [reporterId], references: [id])
  reason     String
  status     ReportStatus @default(OPEN)
  createdAt  DateTime     @default(now())
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String
  action     String   // e.g. VIEW_HOST_IDENTITY, VIEW_RECORDING, BAN_USER
  targetType String
  targetId   String
  createdAt  DateTime @default(now())
}
```

---

## Environment variables

```
DATABASE_URL=            # Neon pooled
DIRECT_URL=              # Neon direct (migrations)
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ADMIN_EMAILS=            # comma-separated; these users get role ADMIN on sign-in
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
DEEPGRAM_API_KEY=
RESEND_API_KEY=
APP_URL=
```

Create `.env.example` with these keys and validate them at startup with Zod (`src/env.ts`).

---

## Build phases

Do the phases in order. At the end of each phase, stop and summarise what was built and how to test it.

### Phase 1 — Scaffold, auth, database
- Next.js + TS + Tailwind project, Prisma schema above, first migration against Neon.
- Auth.js with Google sign-in. On sign-in, upsert the user, update `lastSeenAt`, and set `role = ADMIN` if the email is in `ADMIN_EMAILS`.
- Banned users are signed out and shown a "suspended" page.
- Middleware protects `/dashboard`, `/call/*`, and `/admin/*` (admin only).
- **Done when:** I can sign in with Google, see my user row in Neon, and an admin email can open `/admin`.

### Phase 2 — Calls, lobby, host approval
- `/dashboard`: "New call" form (alias, voice changer on/off + preset, recording on/off). Lists my past calls.
- Alias validation: 2–32 chars; block "admin", "support", "masq", "moderator", and similar (case-insensitive).
- Invite link: `/c/[callId]`.
- Guest flow: sign in → consent screen → "Request to join" → creates a `PENDING` participant → waits (poll or LiveKit data message) → gets a token once admitted.
- Host flow: joins their own room and sees a lobby panel with each pending guest's name, email, and avatar, plus Admit/Deny buttons.
- `POST /api/livekit/token` issues tokens following the core rules (random identity and alias name for the host; Google name and email metadata for guests).
- FREE hosts: max 2 participants including the host. PRO: no limit. Use a single `canUse(feature, user)` helper so plan gating lives in one place.
- Host can end the call for everyone. Mark `status`, `startedAt`, `endedAt`, `joinedAt`, and `leftAt` correctly.
- **Done when:** two Google accounts can join a call, the host must admit the guest, and the guest's browser devtools show no trace of the host's email or user ID.

### Phase 3 — Voice changer (host only)
- `src/lib/voice/` module. Pipeline: `getUserMedia` → `AudioContext` → `AudioWorkletNode` (pitch + formant shift) → `MediaStreamAudioDestinationNode` → publish that track to LiveKit with `room.localParticipant.publishTrack`.
- Implement the worklet with a phase-vocoder or PSOLA pitch shifter, plus a separate formant shift. Presets: `deep`, `high`, `robot`, `neutral-mask` (moderate pitch + formant change).
- Expose a `VoiceProcessor` interface (`start(stream, preset) → MediaStreamTrack`, `setPreset`, `stop`) so an ML voice model can replace the DSP later.
- Host gets a "hear myself" preview before joining. Keep added latency under ~50 ms.
- Voice changer is a PRO feature (gate via `canUse`).
- **Done when:** a guest hears only the disguised voice, and toggling presets mid-call works without reconnecting.

### Phase 4 — Recording and transcription
- If recording is on, start LiveKit Egress when the call goes LIVE: one **track egress per participant** (audio only) plus one **room composite audio** egress (`MIXED`), all writing to R2. File keys look like `calls/<callId>/<livekitIdentity>.ogg` (host identity is already random).
- Show a visible "Recording" indicator to everyone in the room.
- `POST /api/webhooks/livekit`: verify the signature with `WebhookReceiver`. On `egress_ended`, update the `Recording`. When all track recordings for an ended call are `DONE`, start transcription.
- Transcription: send each track file to Deepgram, then merge the segments by timestamp into one transcript. Speaker labels are the host alias for the host and "Name (email)" for guests. Save `segments` and plain `text`.
- When done, email the host via Resend with a link to `/dashboard/calls/[id]`, which shows an audio player (signed R2 URL, 1-hour expiry), the transcript, and a download for `.txt` and `.mp3`/`.ogg`.
- Run the work in background jobs (Vercel background functions or a queue such as Inngest/QStash). Never block webhook responses.
- **Done when:** after a 2-minute test call, the host gets an email and can play the audio and read a correctly labelled transcript.

### Phase 5 — Admin dashboard (`/admin`)
- **Overview:** total users, new users (7/30 days), total calls, live calls now, total recorded minutes.
- **Users:** searchable table with name, email, plan, role, joined, last seen, calls hosted, calls joined, and banned status. Actions: ban/unban, change plan.
- **Hosts (anonymous usage):** every call with its alias. The real host's email is hidden behind a "Reveal" button that writes an `AuditLog` row.
- **Calls:** status, alias, participant count, duration, recorded yes/no. Detail page shows participants (with join/leave times). Recording and transcript access require an open report on that call and are audit-logged.
- **Reports:** list, change status, link to the call.
- **Audit log:** read-only table.
- **Done when:** an admin can find any user, reveal who hosted any call (with an audit row created), and ban an account.

### Phase 6 — Safety and polish
- "Report this call" button for guests during and after a call.
- Rate-limit call creation and token requests.
- Pages: Terms, Privacy (must say the platform can identify hosts and stores recordings), recording consent wording.
- Responsive UI, empty states, loading states, and error toasts.

---

## Code conventions
- `src/app` for routes, `src/lib` for server logic, `src/components` for UI.
- Server Actions or Route Handlers only. Validate every input with Zod.
- Check authorization on the server for every request; never trust the client's role or plan.
- Make small commits, one per meaningful step.
- Ask before adding any dependency not listed in the stack.
