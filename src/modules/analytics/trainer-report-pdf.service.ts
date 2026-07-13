import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');

export type TrainerWorkOverviewReportInput = {
  trainerName: string;
  courseTitle: string;
  generatedAt: Date;
  summary: {
    students: number;
    assignmentsGraded: number;
    assignmentsPending: number;
    quizAttempts: number;
    attendanceMarked: number;
    presentRate: number | null;
  };
  students: Array<{
    name: string;
    email: string;
    assignmentAvg: string;
    quizAvg: string;
    attendanceRate: string;
    assignmentLines: string[];
    quizLines: string[];
    attendanceLines: string[];
  }>;
};

const COLORS = {
  green: '#1b7a4a',
  greenDark: '#0f4d30',
  ink: '#1f2937',
  muted: '#6b7280',
  line: '#d1d5db',
  soft: '#e8f5ee',
};

type PdfDoc = InstanceType<typeof PDFDocument>;

@Injectable()
export class TrainerReportPdfService {
  async renderWorkOverview(input: TrainerWorkOverviewReportInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margins: { top: 48, bottom: 48, left: 48, right: 48 },
        autoFirstPage: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const left = doc.page.margins.left;
      const contentW = pageW - doc.page.margins.left - doc.page.margins.right;

      doc.rect(0, 0, pageW, 84).fill(COLORS.green);
      doc
        .fillColor('#ffffff')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('Ingobyi Academy — Work Overview', left, 18, { width: contentW });
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(input.courseTitle, left, 42, { width: contentW });
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          `Trainer: ${input.trainerName}  ·  Generated ${input.generatedAt.toLocaleString()}`,
          left,
          58,
          { width: contentW },
        );

      let y = 108;
      doc.fillColor(COLORS.greenDark).fontSize(13).font('Helvetica-Bold').text('Summary', left, y);
      y += 22;

      const s = input.summary;
      const summaryLines = [
        `Students: ${s.students}`,
        `Assignments graded: ${s.assignmentsGraded}  ·  Pending: ${s.assignmentsPending}`,
        `Quiz / test attempts: ${s.quizAttempts}`,
        `Attendance records: ${s.attendanceMarked}${
          s.presentRate != null ? `  ·  Present rate: ${s.presentRate}%` : ''
        }`,
      ];
      doc.fillColor(COLORS.ink).fontSize(10).font('Helvetica');
      for (const line of summaryLines) {
        doc.text(line, left, y, { width: contentW });
        y += 16;
      }

      y += 10;
      doc
        .moveTo(left, y)
        .lineTo(left + contentW, y)
        .strokeColor(COLORS.line)
        .stroke();
      y += 18;

      if (input.students.length === 0) {
        doc
          .fillColor(COLORS.muted)
          .fontSize(11)
          .text('No student activity recorded yet.', left, y);
        doc.end();
        return;
      }

      for (const student of input.students) {
        y = this.ensureSpace(doc, y, 120);
        doc.rect(left, y, contentW, 22).fill(COLORS.soft);
        doc
          .fillColor(COLORS.greenDark)
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(student.name, left + 8, y + 6, { width: contentW - 16 });
        y += 28;

        doc
          .fillColor(COLORS.muted)
          .fontSize(9)
          .font('Helvetica')
          .text(student.email, left, y, { width: contentW });
        y += 14;
        doc
          .fillColor(COLORS.ink)
          .text(
            `Assignment avg: ${student.assignmentAvg}  ·  Test avg: ${student.quizAvg}  ·  Attendance: ${student.attendanceRate}`,
            left,
            y,
            { width: contentW },
          );
        y += 18;

        y = this.writeSection(doc, y, left, contentW, 'Assignments', student.assignmentLines);
        y = this.writeSection(doc, y, left, contentW, 'Tests / quizzes', student.quizLines);
        y = this.writeSection(doc, y, left, contentW, 'Attendance', student.attendanceLines);
        y += 12;
      }

      doc.end();
    });
  }

  private ensureSpace(doc: PdfDoc, y: number, need: number): number {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (y + need <= bottom) return y;
    doc.addPage();
    return doc.page.margins.top;
  }

  private writeSection(
    doc: PdfDoc,
    y: number,
    left: number,
    contentW: number,
    title: string,
    lines: string[],
  ): number {
    y = this.ensureSpace(doc, y, 40);
    doc.fillColor(COLORS.green).fontSize(10).font('Helvetica-Bold').text(title, left, y);
    y += 14;
    doc.fillColor(COLORS.ink).fontSize(9).font('Helvetica');
    if (lines.length === 0) {
      doc.fillColor(COLORS.muted).text('None recorded', left, y, { width: contentW });
      return y + 14;
    }
    for (const line of lines) {
      y = this.ensureSpace(doc, y, 16);
      doc.fillColor(COLORS.ink).text(`• ${line}`, left, y, { width: contentW });
      y += 13;
    }
    return y + 4;
  }
}
