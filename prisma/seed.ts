import {
  AchievementTrigger,
  ApiKeyScope,
  CourseStatus,
  CourseType,
  LessonType,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const TEST_PASSWORD = 'password123';
const SAMPLE_VIDEO =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const UAT_TESTERS: {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}[] = [
  {
    email: 'ngirinshutingirimana858@gmail.com',
    firstName: 'Ngirinshuti',
    lastName: 'Ngirimana',
    role: UserRole.STUDENT,
  },
  {
    email: 'robertmunyaburanga8@gmail.com',
    firstName: 'Robert',
    lastName: 'Munyaburanga',
    role: UserRole.STUDENT,
  },
  {
    email: 'kellymshema@gmail.com',
    firstName: 'Kelly',
    lastName: 'Shema',
    role: UserRole.STUDENT,
  },
  {
    email: 'manzitms209@gmail.com',
    firstName: 'Manzi',
    lastName: 'TMC',
    role: UserRole.TRAINER,
  },
  {
    email: 'niyobuhungirooscar40@gmail.com',
    firstName: 'Oscar',
    lastName: 'Niyobuhungiro',
    role: UserRole.STUDENT,
  },
];

type QuizQuestion = {
  text: string;
  options: string[];
  correctIndex: number;
};

function buildQuiz(questions: QuizQuestion[], passingScore = 70) {
  return JSON.stringify({
    passingScore,
    questions: questions.map((q, i) => ({
      id: `q${i + 1}`,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
    })),
  });
}

type LessonSeed = {
  title: string;
  type: LessonType;
  order: number;
  videoUrl?: string;
  content?: string;
  isFree?: boolean;
};

type CourseSeed = {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  categoryIndex: number;
  level: string;
  status: CourseStatus;
  isFeatured?: boolean;
  lessons: LessonSeed[];
  quiz: QuizQuestion[];
};

const COURSE_CATALOG: CourseSeed[] = [
  {
    slug: 'robotics-stem-fundamentals',
    title: 'Robotics & STEM Fundamentals',
    shortDescription: 'Build, code, and understand robots from zero to confident creator',
    description:
      '<p>Hands-on introduction to robotics for Rwandan schools and innovation hubs. Learn sensors, motors, and simple programming through video lessons and a practical quiz.</p>',
    categoryIndex: 0,
    level: 'BEGINNER',
    status: CourseStatus.PUBLISHED,
    isFeatured: true,
    lessons: [
      {
        title: 'Welcome — Why robotics matters in Rwanda',
        type: LessonType.VIDEO,
        order: 1,
        isFree: true,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'Robot building blocks: sensors & actuators',
        type: LessonType.TEXT,
        order: 2,
        content:
          '<h3>Core components</h3><ul><li><strong>Sensors</strong> — eyes and ears (ultrasonic, light, touch)</li><li><strong>Actuators</strong> — muscles (motors, servos)</li><li><strong>Controller</strong> — the brain (microcontroller or single-board computer)</li></ul><p>Every robot loop: <em>sense → think → act</em>.</p>',
      },
      {
        title: 'Programming your first robot behavior',
        type: LessonType.VIDEO,
        order: 3,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'Safety, teamwork & project planning',
        type: LessonType.TEXT,
        order: 4,
        content:
          '<p>Before building, agree on roles, document your wiring, and always power off when changing connections. Good engineers communicate clearly with teammates and mentors.</p>',
      },
      {
        title: 'Robotics knowledge check',
        type: LessonType.QUIZ,
        order: 5,
      },
    ],
    quiz: [
      {
        text: 'What is the correct order of a robot control loop?',
        options: ['Sense → Think → Act', 'Act → Sense → Think', 'Think → Act → Sense', 'Charge → Sleep → Repeat'],
        correctIndex: 0,
      },
      {
        text: 'Which component moves a robot wheel?',
        options: ['Actuator (motor)', 'Thermometer', 'Keyboard', 'Monitor'],
        correctIndex: 0,
      },
      {
        text: 'Why use an ultrasonic sensor?',
        options: ['To measure distance to objects', 'To play music', 'To store files', 'To connect Wi‑Fi'],
        correctIndex: 0,
      },
    ],
  },
  {
    slug: 'digital-literacy-rwanda',
    title: 'Digital Literacy for Modern Rwanda',
    shortDescription: 'Computer basics, online safety, and productivity skills for every learner',
    description:
      '<p>Essential digital skills — hardware, software, cloud tools, and safe internet habits — tailored for students and young professionals in Rwanda.</p>',
    categoryIndex: 0,
    level: 'BEGINNER',
    status: CourseStatus.PUBLISHED,
    lessons: [
      {
        title: 'Inside your computer & smartphone',
        type: LessonType.VIDEO,
        order: 1,
        isFree: true,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'Files, folders & cloud storage',
        type: LessonType.TEXT,
        order: 2,
        content:
          '<p>Organize school work with clear folder names, back up to Google Drive or OneDrive, and never rely on a single device. Use version dates in filenames: <code>Essay_2026-03-20.docx</code>.</p>',
      },
      {
        title: 'Productivity: docs, sheets & slides',
        type: LessonType.VIDEO,
        order: 3,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'Staying safe online',
        type: LessonType.TEXT,
        order: 4,
        content:
          '<ul><li>Use strong unique passwords + two-factor authentication</li><li>Verify sender identity before clicking links</li><li>Never share OTP codes</li><li>Report suspicious messages to your teacher or admin</li></ul>',
      },
      {
        title: 'Digital literacy quiz',
        type: LessonType.QUIZ,
        order: 5,
      },
    ],
    quiz: [
      {
        text: 'What does CPU stand for?',
        options: ['Central Processing Unit', 'Computer Personal Utility', 'Central Power Usage', 'Core Program Unit'],
        correctIndex: 0,
      },
      {
        text: 'Best practice for important school files?',
        options: ['Keep a backup in the cloud', 'Delete after saving once', 'Email only to yourself', 'Store on desktop only'],
        correctIndex: 0,
      },
      {
        text: 'You receive an urgent “verify your account” link. You should:',
        options: ['Ignore and report — verify through the official app', 'Click immediately', 'Forward to all friends', 'Reply with your password'],
        correctIndex: 0,
      },
    ],
  },
  {
    slug: 'web-development-foundations',
    title: 'Web Development Foundations',
    shortDescription: 'HTML, CSS & JavaScript — build your first professional web pages',
    description:
      '<p>From first tag to interactive pages. Learn how the web works, structure content with HTML, style with CSS, and add behavior with JavaScript.</p>',
    categoryIndex: 0,
    level: 'INTERMEDIATE',
    status: CourseStatus.PUBLISHED,
    lessons: [
      {
        title: 'How the web works',
        type: LessonType.VIDEO,
        order: 1,
        isFree: true,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'HTML structure & accessibility',
        type: LessonType.TEXT,
        order: 2,
        content:
          '<p>Use semantic tags: <code>&lt;header&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;footer&gt;</code>. Add <code>alt</code> text on images and labels on form fields so everyone can use your site.</p>',
      },
      {
        title: 'CSS layout & responsive design',
        type: LessonType.VIDEO,
        order: 3,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'JavaScript basics — variables & events',
        type: LessonType.TEXT,
        order: 4,
        content:
          '<p>JavaScript makes pages interactive. Start with <code>const</code> and <code>let</code>, select elements with <code>document.querySelector</code>, and respond to clicks with event listeners.</p>',
      },
      {
        title: 'Web development quiz',
        type: LessonType.QUIZ,
        order: 5,
      },
    ],
    quiz: [
      {
        text: 'Which language defines the structure of a web page?',
        options: ['HTML', 'CSS', 'Python', 'SQL'],
        correctIndex: 0,
      },
      {
        text: 'CSS is mainly used for:',
        options: ['Visual presentation and layout', 'Database queries', 'Server routing', 'Email delivery'],
        correctIndex: 0,
      },
      {
        text: 'Responsive design means:',
        options: ['Pages adapt to different screen sizes', 'Pages load without internet', 'Pages never use images', 'Pages hide all text on mobile'],
        correctIndex: 0,
      },
    ],
  },
  {
    slug: 'entrepreneurship-business-basics',
    title: 'Entrepreneurship & Business Basics',
    shortDescription: 'Turn ideas into viable small businesses in the Rwandan market',
    description:
      '<p>Customer discovery, pricing, simple financial planning, and pitching — practical entrepreneurship for youth and community innovators.</p>',
    categoryIndex: 1,
    level: 'BEGINNER',
    status: CourseStatus.PUBLISHED,
    lessons: [
      {
        title: 'Mindset of an entrepreneur',
        type: LessonType.VIDEO,
        order: 1,
        isFree: true,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'Finding real customer problems',
        type: LessonType.TEXT,
        order: 2,
        content:
          '<p>Interview at least 10 potential customers before building. Ask about their current solutions, pain points, and willingness to pay. Document quotes verbatim.</p>',
      },
      {
        title: 'Business model canvas walkthrough',
        type: LessonType.VIDEO,
        order: 3,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'Pricing, costs & simple profit',
        type: LessonType.TEXT,
        order: 4,
        content:
          '<p>Revenue − Costs = Profit. Include transport, materials, time, and platform fees. Price for sustainability, not just popularity.</p>',
      },
      {
        title: 'Entrepreneurship quiz',
        type: LessonType.QUIZ,
        order: 5,
      },
    ],
    quiz: [
      {
        text: 'Before building a product you should:',
        options: ['Validate the problem with real customers', 'Buy expensive equipment first', 'Skip research to move fast', 'Copy a competitor exactly'],
        correctIndex: 0,
      },
      {
        text: 'A business model canvas helps you:',
        options: ['Map how you create and capture value', 'Design a company logo only', 'File taxes automatically', 'Hire staff without interviews'],
        correctIndex: 0,
      },
      {
        text: 'Sustainable pricing must cover:',
        options: ['Costs plus a reasonable margin', 'Only marketing spend', 'Only rent', 'Nothing — free is always best'],
        correctIndex: 0,
      },
    ],
  },
  {
    slug: 'creative-arts-design-thinking',
    title: 'Creative Arts & Design Thinking',
    shortDescription: 'Express ideas through art, design process, and collaborative projects',
    description:
      '<p>Explore color, composition, storytelling, and human-centered design. Perfect for learners combining creativity with technology projects.</p>',
    categoryIndex: 4,
    level: 'ALL_LEVELS',
    status: CourseStatus.PUBLISHED,
    lessons: [
      {
        title: 'Introduction to design thinking',
        type: LessonType.VIDEO,
        order: 1,
        isFree: true,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'Color, contrast & visual hierarchy',
        type: LessonType.TEXT,
        order: 2,
        content:
          '<p>Use contrast to guide attention. Limit palettes to 2–3 primary colors plus neutrals. Headings should be clearly larger than body text.</p>',
      },
      {
        title: 'Sketching & prototyping fast',
        type: LessonType.VIDEO,
        order: 3,
        videoUrl: SAMPLE_VIDEO,
      },
      {
        title: 'Presenting creative work with confidence',
        type: LessonType.TEXT,
        order: 4,
        content:
          '<p>Structure: problem → your idea → demo → next steps. Practice in pairs, time your pitch (3 minutes), and welcome feedback as improvement, not criticism.</p>',
      },
      {
        title: 'Creative arts quiz',
        type: LessonType.QUIZ,
        order: 5,
      },
    ],
    quiz: [
      {
        text: 'Design thinking starts with:',
        options: ['Empathizing with users', 'Choosing fonts randomly', 'Ignoring feedback', 'Finalizing the logo first'],
        correctIndex: 0,
      },
      {
        text: 'Visual hierarchy helps users:',
        options: ['Know what to read first', 'Disable accessibility', 'Hide navigation', 'Remove all colors'],
        correctIndex: 0,
      },
      {
        text: 'A low-fidelity prototype is:',
        options: ['A quick rough model to test ideas', 'The final manufactured product', 'A legal contract', 'A printed certificate'],
        correctIndex: 0,
      },
    ],
  },
];

type ModuleSeed = { title: string; order: number; lessons: LessonSeed[] };

async function resetCourseCurriculum(
  courseId: string,
  modules: ModuleSeed[],
  published: boolean,
) {
  await prisma.courseModule.deleteMany({ where: { courseId } });

  for (const modSeed of modules) {
    const mod = await prisma.courseModule.create({
      data: {
        courseId,
        title: modSeed.title,
        order: modSeed.order,
        isPublished: published,
      },
    });

    for (const lessonSeed of modSeed.lessons) {
      await prisma.lesson.create({
        data: {
          moduleId: mod.id,
          title: lessonSeed.title,
          type: lessonSeed.type,
          order: lessonSeed.order,
          videoUrl: lessonSeed.videoUrl,
          content: lessonSeed.content,
          isFree: lessonSeed.isFree ?? false,
          isPublished: published,
        },
      });
    }
  }
}

function courseToModules(seed: CourseSeed): ModuleSeed[] {
  const lessons = seed.lessons.map((lesson) => {
    if (lesson.type === LessonType.QUIZ) {
      return { ...lesson, content: buildQuiz(seed.quiz) };
    }
    return lesson;
  });

  return [
    {
      title: 'Module 1 — Core lessons',
      order: 1,
      lessons: lessons.slice(0, 3),
    },
    {
      title: 'Module 2 — Practice & assessment',
      order: 2,
      lessons: lessons.slice(3),
    },
  ];
}

async function upsertCourse(
  data: Omit<Prisma.CourseCreateInput, 'trainers'> & { slug: string },
  modules: ModuleSeed[],
  trainerId: string,
) {
  const published = data.status === CourseStatus.PUBLISHED;

  const course = await prisma.course.upsert({
    where: { slug: data.slug },
    create: {
      ...data,
      publishedAt: published ? new Date() : null,
      trainers: { create: { userId: trainerId, isPrimary: true } },
    },
    update: {
      title: data.title,
      description: data.description,
      shortDescription: data.shortDescription,
      status: data.status,
      type: data.type,
      level: data.level,
      publishedAt: published ? new Date() : null,
    },
  });

  await prisma.courseTrainer.upsert({
    where: { courseId_userId: { courseId: course.id, userId: trainerId } },
    create: { courseId: course.id, userId: trainerId, isPrimary: true },
    update: { isPrimary: true },
  });

  await prisma.courseChatRoom.upsert({
    where: { courseId: course.id },
    create: { courseId: course.id },
    update: {},
  });

  await resetCourseCurriculum(course.id, modules, published);
  return course;
}

async function enrollUser(userId: string, courseId: string) {
  return prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, source: 'SEED' },
    update: { status: 'ACTIVE' },
  });
}

async function main(): Promise<void> {
  console.log('Seeding Ingobyi Academy...');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const categories = await Promise.all(
    ['Technology', 'Business', 'Languages', 'Health', 'Arts'].map((name) =>
      prisma.courseCategory.upsert({
        where: { slug: name.toLowerCase() },
        create: { name, slug: name.toLowerCase() },
        update: {},
      }),
    ),
  );

  const defaultCertificateSettings = {
    certificate: {
      ceoName: 'Niyomugabo Fidele',
      ceoTitle: 'Coregroup Ltd CEO',
      programLeaderName: 'Cyubahiro Richard',
      programLeaderTitle: 'Ingobyi Innovation Hub Leader',
      issuerOrgName: 'Ingobyi Innovation Hub',
    },
  };

  const primaryOrg = await prisma.organization.upsert({
    where: { slug: 'ingobyi-innovation-hub' },
    create: {
      name: 'Ingobyi Innovation Hub',
      slug: 'ingobyi-innovation-hub',
      type: OrganizationType.TRAINING_CENTER,
      country: 'Rwanda',
      city: 'Kigali',
      isVerified: true,
      settings: defaultCertificateSettings,
    },
    update: { settings: defaultCertificateSettings },
  });

  const superadmin = await prisma.user.upsert({
    where: { email: 'fidelniyomugabo67@gmail.com' },
    create: {
      email: 'fidelniyomugabo67@gmail.com',
      passwordHash,
      firstName: 'Niyomugabo',
      lastName: 'Fidele',
      platformRole: UserRole.SUPERADMIN,
      isVerified: true,
    },
    update: { passwordHash, isVerified: true, firstName: 'Niyomugabo', lastName: 'Fidele' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'cyubahirorichard250@gmail.com' },
    create: {
      email: 'cyubahirorichard250@gmail.com',
      passwordHash,
      firstName: 'Cyubahiro',
      lastName: 'Richard',
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  const student = await prisma.user.upsert({
    where: { email: 'holly.worshiptv@gmail.com' },
    create: {
      email: 'holly.worshiptv@gmail.com',
      passwordHash,
      firstName: 'Holly',
      lastName: 'Worship',
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  const parent = await prisma.user.upsert({
    where: { email: 'nfidele290@gmail.com' },
    create: {
      email: 'nfidele290@gmail.com',
      passwordHash,
      firstName: 'Niyomugabo',
      lastName: 'Fidele',
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: admin.id, orgId: primaryOrg.id } },
    create: { userId: admin.id, orgId: primaryOrg.id, role: UserRole.ADMIN },
    update: { role: UserRole.ADMIN, status: 'ACTIVE' },
  });

  for (const tester of UAT_TESTERS) {
    const testerUser = await prisma.user.upsert({
      where: { email: tester.email },
      create: {
        email: tester.email,
        passwordHash,
        firstName: tester.firstName,
        lastName: tester.lastName,
        isVerified: true,
      },
      update: {
        passwordHash,
        isVerified: true,
        firstName: tester.firstName,
        lastName: tester.lastName,
      },
    });
    await prisma.membership.upsert({
      where: { userId_orgId: { userId: testerUser.id, orgId: primaryOrg.id } },
      create: {
        userId: testerUser.id,
        orgId: primaryOrg.id,
        role: tester.role,
      },
      update: { role: tester.role, status: 'ACTIVE' },
    });
  }

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: student.id, orgId: primaryOrg.id } },
    create: { userId: student.id, orgId: primaryOrg.id, role: UserRole.STUDENT },
    update: { role: UserRole.STUDENT },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: parent.id, orgId: primaryOrg.id } },
    create: { userId: parent.id, orgId: primaryOrg.id, role: UserRole.PARENT },
    update: { role: UserRole.PARENT },
  });

  await prisma.parentChildLink.upsert({
    where: { parentId_childId: { parentId: parent.id, childId: student.id } },
    create: { parentId: parent.id, childId: student.id, approvedAt: new Date() },
    update: { approvedAt: new Date() },
  });

  const courses = [];
  for (const def of COURSE_CATALOG) {
    const course = await upsertCourse(
      {
        slug: def.slug,
        title: def.title,
        description: def.description,
        shortDescription: def.shortDescription,
        status: def.status,
        type: CourseType.SELF_PACED,
        level: def.level,
        org: { connect: { id: primaryOrg.id } },
        category: { connect: { id: categories[def.categoryIndex].id } },
        isFeatured: def.isFeatured ?? false,
      },
      courseToModules(def),
      admin.id,
    );
    courses.push(course);
    await enrollUser(student.id, course.id);
  }

  await prisma.communityPost.deleteMany({
    where: { orgId: primaryOrg.id },
  });

  await prisma.communityPost.createMany({
    data: [
      {
        authorId: student.id,
        orgId: primaryOrg.id,
        content:
          'Just enrolled in Robotics & STEM Fundamentals — excited to learn with Ingobyi Academy! 🚀',
      },
      {
        authorId: admin.id,
        orgId: primaryOrg.id,
        content:
          'Welcome testers! All five demo courses are live with 5 lessons each. Complete the quiz at the end of every course to earn progress.',
      },
      {
        authorId: superadmin.id,
        orgId: primaryOrg.id,
        content:
          'Platform ready for UAT. Report any issues to the admin team. Happy learning!',
      },
    ],
  });

  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { title: 'Welcome to Ingobyi Academy — Demo Ready' },
  });
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        title: 'Welcome to Ingobyi Academy — Demo Ready',
        content:
          '<p>Five full test courses are now available. Log in, enroll, complete lessons, and pass each 3-question quiz. Password for all demo accounts: <strong>password123</strong>.</p>',
        scope: 'PLATFORM',
        authorId: superadmin.id,
        publishedAt: new Date(),
      },
    });
  }

  await prisma.achievementDefinition.createMany({
    data: [
      {
        title: 'Course Champion',
        description: 'Complete your first course',
        trigger: AchievementTrigger.COURSE_COMPLETED,
        threshold: 1,
        points: 50,
      },
      {
        title: 'Quiz Master',
        description: 'Pass three course quizzes',
        trigger: AchievementTrigger.LESSONS_COMPLETED,
        threshold: 3,
        points: 30,
      },
    ],
    skipDuplicates: true,
  });

  const DEMO_PARTNER_API_KEY =
    'ia_demo000000000000000000000000000000000000000000000000000000000000';
  const demoKeyHash = createHash('sha256').update(DEMO_PARTNER_API_KEY).digest('hex');

  await prisma.apiKey.upsert({
    where: { keyHash: demoKeyHash },
    create: {
      name: 'Demo Partner Integration Key',
      keyHash: demoKeyHash,
      keyPrefix: DEMO_PARTNER_API_KEY.slice(0, 8),
      userId: superadmin.id,
      orgId: primaryOrg.id,
      scopes: [
        ApiKeyScope.COURSE_READ,
        ApiKeyScope.ENROLLMENT_READ,
        ApiKeyScope.ENROLLMENT_WRITE,
        ApiKeyScope.CERTIFICATE_VERIFY,
        ApiKeyScope.LEARNER_READ,
      ],
    },
    update: { isActive: true, orgId: primaryOrg.id },
  });

  console.log('');
  console.log('Seed complete.');
  console.log('');
  console.log('Demo accounts (password: ' + TEST_PASSWORD + ')');
  console.log('-------------------------------------------------------');
  console.log('SUPERADMIN  fidelniyomugabo67@gmail.com');
  console.log('ADMIN       cyubahirorichard250@gmail.com     → Ingobyi Innovation Hub admin');
  console.log('TRAINER     manzitms209@gmail.com             → Ingobyi Innovation Hub trainer');
  console.log('STUDENT     holly.worshiptv@gmail.com         → enrolled in all 5 courses');
  console.log('PARENT      nfidele290@gmail.com              → linked to Holly');
  console.log('-------------------------------------------------------');
  console.log('UAT testers (password: ' + TEST_PASSWORD + ', all verified, no email OTP):');
  for (const t of UAT_TESTERS) {
    console.log(`  ${t.role.padEnd(10)} ${t.email}`);
  }
  console.log('-------------------------------------------------------');
  console.log('');
  console.log('Five published courses (5 lessons + 3-question quiz each):');
  for (const c of courses) {
    console.log(`  • ${c.slug}`);
  }
  console.log('');
  console.log(`Organization: ${primaryOrg.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
