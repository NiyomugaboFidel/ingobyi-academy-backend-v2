/**fb v
 * Backfill tenant data into a default organization.
 * Run: npx ts-node prisma/scripts/backfill-default-org.ts
 */
import { PrismaClient, ResourceVisibility, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ORG_SLUG = 'ingobyi-platform';
const DEFAULT_ORG_NAME = 'Ingobyi Platform';

async function main(): Promise<void> {
  console.log('Backfilling default organization...');

  let org = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORG_SLUG },
  });

  if (!org) {
    const superadmin = await prisma.user.findFirst({
      where: { platformRole: UserRole.SUPERADMIN },
    });
    org = await prisma.organization.create({
      data: {
        name: DEFAULT_ORG_NAME,
        slug: DEFAULT_ORG_SLUG,
        type: 'SCHOOL',
        ownerId: superadmin?.id,
        isVerified: true,
      },
    });
    console.log(`Created default org: ${org.name} (${org.id})`);
  } else {
    console.log(`Using existing org: ${org.name} (${org.id})`);
  }

  const coursesWithoutOrg = await prisma.course.updateMany({
    where: { orgId: null },
    data: {
      orgId: org.id,
      visibility: ResourceVisibility.ORG_PRIVATE,
    },
  });
  console.log(`Backfilled ${coursesWithoutOrg.count} courses with orgId`);

  const users = await prisma.user.findMany({
    where: {
      platformRole: { not: UserRole.SUPERADMIN },
      memberships: { none: {} },
    },
    select: { id: true },
  });

  for (const user of users) {
    await prisma.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: org.id } },
      create: { userId: user.id, orgId: org.id, role: UserRole.STUDENT },
      update: {},
    });
  }
  console.log(`Ensured ${users.length} users have default membership`);

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
