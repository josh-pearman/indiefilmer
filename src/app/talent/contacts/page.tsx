import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { isEmailEnabled } from "@/lib/email";
import { ContactsList } from "@/components/contacts/contacts-list";

export type ContactRow = {
  id: string;
  type: "cast" | "crew";
  name: string;
  role: string;
  uncasted: boolean;
  phone: string | null;
  email: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  intakeToken: string | null;
};

async function getContacts(): Promise<ContactRow[]> {
  const projectId = await requireCurrentProjectId();
  const [castMembers, crewMembers] = await Promise.all([
    prisma.castMember.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { actorName: "asc" },
      select: {
        id: true,
        name: true,
        actorName: true,
        phone: true,
        email: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        intakeToken: true,
      },
    }),
    prisma.crewMember.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        position: true,
        phone: true,
        email: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        intakeToken: true,
      },
    }),
  ]);

  const castContacts: ContactRow[] = castMembers.map((c) => ({
    id: c.id,
    type: "cast",
    name: c.actorName || c.name,
    role: c.name,
    uncasted: !c.actorName,
    phone: c.phone,
    email: c.email,
    emergencyContactName: c.emergencyContactName,
    emergencyContactPhone: c.emergencyContactPhone,
    intakeToken: c.intakeToken,
  }));

  const crewContacts: ContactRow[] = crewMembers.map((c) => ({
    id: c.id,
    type: "crew",
    name: c.name,
    role: c.position,
    uncasted: false,
    phone: c.phone,
    email: c.email,
    emergencyContactName: c.emergencyContactName,
    emergencyContactPhone: c.emergencyContactPhone,
    intakeToken: c.intakeToken,
  }));

  return [...castContacts, ...crewContacts];
}

export default async function ContactsPage() {
  const projectId = await requireCurrentProjectId();
  const [contacts, project] = await Promise.all([
    getContacts(),
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Phone, email, and emergency contact info for all cast and crew
          members.
        </p>
      </div>
      <ContactsList contacts={contacts} projectName={project?.name ?? "Untitled Project"} emailEnabled={isEmailEnabled()} />
    </div>
  );
}
