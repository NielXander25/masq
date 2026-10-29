-- CreateTable
CREATE TABLE "CallMessage" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallMessage_callId_createdAt_idx" ON "CallMessage"("callId", "createdAt");

-- AddForeignKey
ALTER TABLE "CallMessage" ADD CONSTRAINT "CallMessage_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallMessage" ADD CONSTRAINT "CallMessage_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

