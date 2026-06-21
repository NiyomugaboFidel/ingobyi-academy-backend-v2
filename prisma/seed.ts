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

const ROBOTICS_QUIZ = {
  passingScore: 70,
  questions: [
    {
      id: 'q1',
      text: 'What is a robot?',
      options: [
        'A machine that can carry out tasks automatically',
        'A type of plant',
        'A programming language',
        'A musical instrument',
      ],
      correctIndex: 0,
    },
    {
      id: 'q2',
      text: 'Which sensor helps a robot detect distance?',
      options: ['Ultrasonic sensor', 'Thermometer', 'Speaker', 'Keyboard'],
      correctIndex: 0,
    },
    {
      id: 'q3',
      text: 'What does programming a robot mean?',
      options: [
        'Giving instructions the robot can follow',
        'Painting the robot',
        'Charging the battery only',
        'Removing its wheels',
      ],
      correctIndex: 0,
    },
  ],
};

const DIGITAL_QUIZ = {
  passingScore: 60,
  questions: [
    {
      id: 'd1',
      text: 'What does CPU stand for?',
      options: [
        'Central Processing Unit',
        'Computer Personal Utility',
        'Central Power Usage',
        'Core Program Unit',
      ],
      correctIndex: 0,
    },
    {
      id: 'd2',
      text: 'Which device stores files long-term?',
      options: ['Hard drive or SSD', 'Monitor', 'Mouse', 'Webcam'],
      correctIndex: 0,
    },
  ],
};

type LessonSeed = {
  title: string;
  type: LessonType;
  order: number;
  videoUrl?: string;
  content?: string;
  isFree?: boolean;
  assignment?: {
    title: string;
    instructions: string;
    maxScore?: number;
  };
};

type ModuleSeed = {
  title: string;
  order: number;
  lessons: LessonSeed[];
};

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
      const lesson = await prisma.lesson.create({
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

      if (lessonSeed.assignment) {
        await prisma.assignment.create({
          data: {
            lessonId: lesson.id,
            title: lessonSeed.assignment.title,
            instructions: lessonSeed.assignment.instructions,
            maxScore: lessonSeed.assignment.maxScore ?? 100,
          },
        });
      }
    }
  }
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
    where: { slug: 'kigali-tech-school' },
    create: {
      name: 'Kigali Tech School',
      slug: 'kigali-tech-school',
      type: OrganizationType.SCHOOL,
      country: 'Rwanda',
      city: 'Kigali',
      isVerified: true,
      settings: defaultCertificateSettings,
    },
    update: {
      settings: defaultCertificateSettings,
    },
  });

  await prisma.organization.upsert({
    where: { slug: 'rwanda-training-center' },
    create: {
      name: 'Rwanda Training Center',
      slug: 'rwanda-training-center',
      type: OrganizationType.TRAINING_CENTER,
      country: 'Rwanda',
      city: 'Kigali',
      isVerified: true,
    },
    update: {},
  });

  const superadmin = await prisma.user.upsert({
    where: { email: 'super@ingobyi.com' },
    create: {
      email: 'super@ingobyi.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      platformRole: UserRole.SUPERADMIN,
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  const testAdmin = await prisma.user.upsert({
    where: { email: 'admin@ingobyi.com' },
    create: {
      email: 'admin@ingobyi.com',
      passwordHash,
      firstName: 'Test',
      lastName: 'Admin',
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  const testTrainer = await prisma.user.upsert({
    where: { email: 'trainer@ingobyi.com' },
    create: {
      email: 'trainer@ingobyi.com',
      passwordHash,
      firstName: 'Test',
      lastName: 'Trainer',
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  const testStudent = await prisma.user.upsert({
    where: { email: 'student@ingobyi.com' },
    create: {
      email: 'student@ingobyi.com',
      passwordHash,
      firstName: 'Test',
      lastName: 'Student',
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  const testStudent2 = await prisma.user.upsert({
    where: { email: 'student2@ingobyi.com' },
    create: {
      email: 'student2@ingobyi.com',
      passwordHash,
      firstName: 'Aline',
      lastName: 'Uwase',
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  const testParent = await prisma.user.upsert({
    where: { email: 'parent@ingobyi.com' },
    create: {
      email: 'parent@ingobyi.com',
      passwordHash,
      firstName: 'Test',
      lastName: 'Parent',
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  const pendingUser = await prisma.user.upsert({
    where: { email: 'pending@ingobyi.com' },
    create: {
      email: 'pending@ingobyi.com',
      passwordHash,
      firstName: 'Pending',
      lastName: 'Applicant',
      isVerified: true,
    },
    update: { passwordHash, isVerified: true },
  });

  for (const [user, role] of [
    [testAdmin, UserRole.ADMIN],
    [testTrainer, UserRole.TRAINER],
    [testStudent, UserRole.STUDENT],
    [testStudent2, UserRole.STUDENT],
    [testParent, UserRole.PARENT],
  ] as const) {
    await prisma.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: primaryOrg.id } },
      create: { userId: user.id, orgId: primaryOrg.id, role },
      update: { role },
    });
  }

  await prisma.parentChildLink.upsert({
    where: { parentId_childId: { parentId: testParent.id, childId: testStudent.id } },
    create: {
      parentId: testParent.id,
      childId: testStudent.id,
      approvedAt: new Date(),
    },
    update: { approvedAt: new Date() },
  });

  // ── Four primary-org courses for full role testing ──────────────────

  const introRobotics = await upsertCourse(
    {
      slug: 'intro-robotics-101',
      title: 'Introduction to Robotics 101',
      description:
        '<p>Learn robotics fundamentals through video lessons, reading, a quiz, and a hands-on assignment. Complete all lessons to earn your certificate.</p>',
      shortDescription: 'Build your first robot — video, quiz & assignment path',
      status: CourseStatus.PUBLISHED,
      type: CourseType.SELF_PACED,
      level: 'BEGINNER',
      org: { connect: { id: primaryOrg.id } },
      category: { connect: { id: categories[0].id } },
      isFeatured: true,
    },
    [
      {
        title: 'Module 1 — Getting started',
        order: 1,
        lessons: [
          {
            title: 'Welcome to Robotics',
            type: LessonType.VIDEO,
            order: 1,
            isFree: true,
            videoUrl: 'https://www.youtube.com/watch?v=saNKgCYX3FM',
          },
          {
            title: 'What is a robot?',
            type: LessonType.TEXT,
            order: 2,
            content:
              '<p>A <strong>robot</strong> is a machine that can sense its environment, process information, and act on the world. In this course you will learn the building blocks: sensors, actuators, and control programs.</p><p>By the end you will design a simple robot plan and submit it for trainer review.</p>',
          },
        ],
      },
      {
        title: 'Module 2 — Assessment',
        order: 2,
        lessons: [
          {
            title: 'Robotics knowledge check',
            type: LessonType.QUIZ,
            order: 1,
            content: JSON.stringify(ROBOTICS_QUIZ),
          },
          {
            title: 'Design your robot plan',
            type: LessonType.ASSIGNMENT,
            order: 2,
            assignment: {
              title: 'Robot design proposal',
              instructions:
                '<p>Write a short proposal (200+ words) describing a robot you would build for your school. Include:</p><ul><li>Purpose of the robot</li><li>Sensors needed</li><li>One challenge you expect</li></ul><p>Your trainer will review and grade this before you can finish the course.</p>',
              maxScore: 100,
            },
          },
        ],
      },
    ],
    testTrainer.id,
  );

  const digitalLiteracy = await upsertCourse(
    {
      slug: 'digital-literacy-basics',
      title: 'Digital Literacy Basics',
      description: '<p>Essential computer skills for students — hardware, software, and safe online habits.</p>',
      shortDescription: 'Computer basics for beginners',
      status: CourseStatus.PUBLISHED,
      type: CourseType.SELF_PACED,
      level: 'BEGINNER',
      org: { connect: { id: primaryOrg.id } },
      category: { connect: { id: categories[0].id } },
    },
    [
      {
        title: 'Module 1 — Computer fundamentals',
        order: 1,
        lessons: [
          {
            title: 'Inside a computer',
            type: LessonType.VIDEO,
            order: 1,
            isFree: true,
            videoUrl: 'https://www.youtube.com/watch?v=ExxFxD4OSZ0',
          },
          {
            title: 'Staying safe online',
            type: LessonType.TEXT,
            order: 2,
            content:
              '<p>Learn to create strong passwords, recognize phishing, and protect your personal information online.</p>',
          },
          {
            title: 'Digital literacy quiz',
            type: LessonType.QUIZ,
            order: 3,
            content: JSON.stringify(DIGITAL_QUIZ),
          },
        ],
      },
    ],
    testTrainer.id,
  );

  const webDevPending = await upsertCourse(
    {
      slug: 'web-development-fundamentals',
      title: 'Web Development Fundamentals',
      description: '<p>HTML, CSS, and JavaScript for building modern websites. Awaiting admin approval.</p>',
      shortDescription: 'Learn to build websites from scratch',
      status: CourseStatus.PENDING_REVIEW,
      type: CourseType.SELF_PACED,
      level: 'INTERMEDIATE',
      org: { connect: { id: primaryOrg.id } },
      category: { connect: { id: categories[0].id } },
    },
    [
      {
        title: 'Module 1 — Web basics',
        order: 1,
        lessons: [
          {
            title: 'How the web works',
            type: LessonType.VIDEO,
            order: 1,
            videoUrl: 'https://www.youtube.com/watch?v=HGTWB3Fl_qc',
          },
          {
            title: 'HTML structure',
            type: LessonType.TEXT,
            order: 2,
            content: '<p>HTML tags, elements, and semantic structure for accessible web pages.</p>',
          },
        ],
      },
    ],
    testTrainer.id,
  );

  const creativeDraft = await upsertCourse(
    {
      slug: 'creative-coding-studio',
      title: 'Creative Coding Studio',
      description: '<p>Draft course — trainer is still building curriculum.</p>',
      shortDescription: 'Art meets code (draft)',
      status: CourseStatus.DRAFT,
      type: CourseType.SELF_PACED,
      level: 'BEGINNER',
      org: { connect: { id: primaryOrg.id } },
      category: { connect: { id: categories[4].id } },
    },
    [
      {
        title: 'Module 1 — Ideas',
        order: 1,
        lessons: [
          {
            title: 'What is creative coding?',
            type: LessonType.TEXT,
            order: 1,
            content: '<p>Creative coding combines programming with visual art, music, and interactive design.</p>',
          },
        ],
      },
    ],
    testTrainer.id,
  );

  // ── Enrollments ─────────────────────────────────────────────────────

  await enrollUser(testStudent.id, introRobotics.id);
  await enrollUser(testStudent.id, digitalLiteracy.id);
  await enrollUser(testStudent2.id, introRobotics.id);
  await enrollUser(testStudent2.id, digitalLiteracy.id);

  // student2: partial progress on digital literacy (lesson 1 complete)
  const digitalLessons = await prisma.lesson.findMany({
    where: { module: { courseId: digitalLiteracy.id } },
    orderBy: { order: 'asc' },
  });
  const student2DigitalEnrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: testStudent2.id, courseId: digitalLiteracy.id } },
  });
  if (student2DigitalEnrollment && digitalLessons[0]) {
    await prisma.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: student2DigitalEnrollment.id,
          lessonId: digitalLessons[0].id,
        },
      },
      create: {
        enrollmentId: student2DigitalEnrollment.id,
        lessonId: digitalLessons[0].id,
        isCompleted: true,
        completedAt: new Date(),
        watchedSec: 420,
      },
      update: { isCompleted: true, completedAt: new Date(), watchedSec: 420 },
    });
  }

  // student2: submitted assignment on intro robotics (waiting for trainer grade)
  const assignmentLesson = await prisma.lesson.findFirst({
    where: { module: { courseId: introRobotics.id }, type: LessonType.ASSIGNMENT },
    include: { assignment: true },
  });
  if (assignmentLesson?.assignment) {
    await prisma.submission.upsert({
      where: {
        assignmentId_userId: {
          assignmentId: assignmentLesson.assignment.id,
          userId: testStudent2.id,
        },
      },
      create: {
        assignmentId: assignmentLesson.assignment.id,
        userId: testStudent2.id,
        textContent:
          'I would build a school hallway navigation robot with ultrasonic sensors to help new students find classrooms. Main challenge: accurate distance reading in crowded corridors.',
        submittedAt: new Date(),
      },
      update: {
        textContent:
          'I would build a school hallway navigation robot with ultrasonic sensors to help new students find classrooms. Main challenge: accurate distance reading in crowded corridors.',
        submittedAt: new Date(),
      },
    });
  }

  // ── Join request (admin approval testing) ───────────────────────────

  const existingJoinRequest = await prisma.orgJoinRequest.findFirst({
    where: { orgId: primaryOrg.id, userId: pendingUser.id, status: 'PENDING' },
  });
  if (!existingJoinRequest) {
    await prisma.orgJoinRequest.create({
      data: {
        orgId: primaryOrg.id,
        userId: pendingUser.id,
        requestedRole: UserRole.STUDENT,
        message: 'I am a student at a partner school and would like to join Kigali Tech School.',
        status: 'PENDING',
      },
    });
  }

  // ── Moderation test data ────────────────────────────────────────────

  await prisma.issueReport.deleteMany({
    where: { title: 'Inappropriate comment in community feed' },
  });
  await prisma.issueReport.create({
    data: {
      userId: testStudent2.id,
      type: 'CONTENT',
      title: 'Inappropriate comment in community feed',
      description: 'A community post contains language that should be reviewed by moderators.',
      status: 'OPEN',
    },
  });

  // ── Achievements, community, announcements ──────────────────────────

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
        title: 'Streak Master',
        description: '7-day learning streak',
        trigger: AchievementTrigger.STREAK_DAYS,
        threshold: 7,
        points: 30,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.communityPost.deleteMany({
    where: {
      authorId: { in: [testStudent.id, testTrainer.id, testStudent2.id] },
      orgId: primaryOrg.id,
    },
  });

  await prisma.communityPost.createMany({
    data: [
      {
        authorId: testStudent.id,
        content: 'Excited to start Introduction to Robotics 101! Who else is enrolled?',
        orgId: primaryOrg.id,
      },
      {
        authorId: testTrainer.id,
        content: 'Welcome students! Submit your robot design assignment when you reach Module 2 — I will grade within 24 hours.',
        orgId: primaryOrg.id,
      },
      {
        authorId: testStudent2.id,
        content: 'Just finished the first digital literacy video. Great explanation of computer parts!',
        orgId: primaryOrg.id,
      },
    ],
  });

  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { title: 'Welcome to Ingobyi Academy' },
  });
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        title: 'Welcome to Ingobyi Academy',
        content:
          'Your multi-tenant learning platform is ready. Explore courses, join organizations, and start learning today!',
        scope: 'PLATFORM',
        authorId: superadmin.id,
        publishedAt: new Date(),
      },
    });
  }

  // Sample course reviews for ratings UI
  await prisma.enrollment.updateMany({
    where: { userId: testStudent2.id, courseId: digitalLiteracy.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  const reviewSeeds = [
    {
      userId: testStudent2.id,
      courseId: digitalLiteracy.id,
      rating: 5,
      comment: 'Clear lessons and practical examples. Great for beginners.',
    },
    {
      userId: testStudent.id,
      courseId: introRobotics.id,
      rating: 4,
      comment: 'Hands-on robotics content is excellent. Assignment grading took a little time.',
    },
    {
      userId: testAdmin.id,
      courseId: introRobotics.id,
      rating: 5,
      comment: 'Well structured modules and strong trainer support.',
    },
  ] as const;

  for (const review of reviewSeeds) {
    await prisma.courseReview.upsert({
      where: {
        userId_courseId: {
          userId: review.userId,
          courseId: review.courseId,
        },
      },
      create: review,
      update: {
        rating: review.rating,
        comment: review.comment,
        isVisible: true,
      },
    });
  }

  const DEMO_PARTNER_API_KEY =
    'ia_demo000000000000000000000000000000000000000000000000000000000000';
  const demoKeyHash = createHash('sha256').update(DEMO_PARTNER_API_KEY).digest('hex');
  const partnerScopes = [
    ApiKeyScope.COURSE_READ,
    ApiKeyScope.ENROLLMENT_READ,
    ApiKeyScope.ENROLLMENT_WRITE,
    ApiKeyScope.CERTIFICATE_VERIFY,
    ApiKeyScope.LEARNER_READ,
  ];

  await prisma.apiKey.upsert({
    where: { keyHash: demoKeyHash },
    create: {
      name: 'Demo Partner Integration Key',
      keyHash: demoKeyHash,
      keyPrefix: DEMO_PARTNER_API_KEY.slice(0, 8),
      userId: superadmin.id,
      orgId: primaryOrg.id,
      scopes: partnerScopes,
    },
    update: {
      isActive: true,
      orgId: primaryOrg.id,
      scopes: partnerScopes,
    },
  });

  console.log('');
  console.log('Seed complete.');
  console.log('');
  console.log('Test accounts (password for all: ' + TEST_PASSWORD + ')');
  console.log('-------------------------------------------------------');
  console.log('SUPERADMIN  super@ingobyi.com');
  console.log('ADMIN       admin@ingobyi.com       → approve courses & join requests');
  console.log('TRAINER     trainer@ingobyi.com     → grade student2 assignment');
  console.log('STUDENT     student@ingobyi.com     → full learning path (fresh start)');
  console.log('STUDENT 2   student2@ingobyi.com    → assignment pending grade');
  console.log('PARENT      parent@ingobyi.com      → linked to student@ingobyi.com');
  console.log('APPLICANT   pending@ingobyi.com     → pending org join request');
  console.log('-------------------------------------------------------');
  console.log('');
  console.log('Four courses in Kigali Tech School:');
  console.log('  1. intro-robotics-101          PUBLISHED  ← main test course');
  console.log('  2. digital-literacy-basics     PUBLISHED');
  console.log('  3. web-development-fundamentals PENDING_REVIEW ← admin approval');
  console.log('  4. creative-coding-studio      DRAFT');
  console.log('');
  console.log('Student test flow (student@ingobyi.com):');
  console.log('  1. /student/enrolled → open Introduction to Robotics 101');
  console.log('  2. Watch video → read text → pass quiz (70%+)');
  console.log('  3. Submit assignment → trainer@ grades it');
  console.log('  4. Get certificate at /student/certificates');
  console.log('');
  console.log(`Primary org: ${primaryOrg.name} (${primaryOrg.slug})`);
  console.log(`Flagship course ID: ${introRobotics.id}`);
  console.log('');
  console.log('Partner API (external systems):');
  console.log('  Header: X-API-Key');
  console.log(`  Demo key: ${DEMO_PARTNER_API_KEY}`);
  console.log(`  Org-scoped to: ${primaryOrg.slug}`);
  console.log('  Postman: backend/postman/Ingobyi-Academy-Partner-API.postman_collection.json');
  console.log('  Docs: GET /api/partner');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
