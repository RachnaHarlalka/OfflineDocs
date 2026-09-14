-- DropForeignKey
ALTER TABLE "DocCollaborator" DROP CONSTRAINT "DocCollaborator_docId_fkey";

-- DropForeignKey
ALTER TABLE "DocCollaborator" DROP CONSTRAINT "DocCollaborator_userId_fkey";

-- CreateIndex
CREATE INDEX "DocCollaborator_userId_idx" ON "DocCollaborator"("userId");

-- AddForeignKey
ALTER TABLE "DocCollaborator" ADD CONSTRAINT "DocCollaborator_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocCollaborator" ADD CONSTRAINT "DocCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
