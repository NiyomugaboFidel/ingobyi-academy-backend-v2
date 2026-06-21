import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument = require('pdfkit');
import QRCode = require('qrcode');

export type CertificatePdfInput = {
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  verifyCode: string;
  verifyUrl: string;
  orgName: string;
  programLeaderName: string;
  programLeaderTitle?: string;
  ceoName: string;
  ceoTitle?: string;
};

const COLORS = {
  bg: '#F5F0E8',
  border: '#6B4E2E',
  accent: '#7A5C1E',
  green: '#1F5C4A',
  text: '#2A1E14',
  muted: '#6B5344',
  ink: '#1A120C',
};

type PdfDoc = InstanceType<typeof PDFDocument>;

@Injectable()
export class CertificatePdfService {
  private readonly logger = new Logger(CertificatePdfService.name);
  private readonly storageDir = path.join(
    process.cwd(),
    'storage',
    'certificates',
  );

  ensureStorageDir(): void {
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  getFilePath(verifyCode: string): string {
    return path.join(this.storageDir, `${verifyCode}.pdf`);
  }

  fileExists(verifyCode: string): boolean {
    return fs.existsSync(this.getFilePath(verifyCode));
  }

  async generateAndSave(input: CertificatePdfInput): Promise<string> {
    this.ensureStorageDir();
    const filePath = this.getFilePath(input.verifyCode);
    const buffer = await this.render(input);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  readFile(verifyCode: string): Buffer {
    return fs.readFileSync(this.getFilePath(verifyCode));
  }

  private resolveAsset(filename: string): string | null {
    const candidates = [
      path.join(process.cwd(), 'assets', filename),
      path.join(process.cwd(), '..', 'assets', filename),
      path.join(__dirname, '..', '..', '..', 'assets', filename),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    this.logger.warn(`Certificate asset missing: ${filename}`);
    return null;
  }

  private drawCenteredLogos(
    doc: PdfDoc,
    pageW: number,
    y: number,
    ingobyiPath: string | null,
    coregroupPath: string | null,
  ): number {
    const ingobyiH = 46;
    const coregroupW = 96;
    const gap = 12;
    const ingobyiW = ingobyiH;
    const totalW =
      (ingobyiPath ? ingobyiW : 0) +
      (ingobyiPath && coregroupPath ? gap : 0) +
      (coregroupPath ? coregroupW : 0);

    let x = pageW / 2 - totalW / 2;

    if (ingobyiPath) {
      doc.image(ingobyiPath, x, y, { height: ingobyiH, width: ingobyiW });
      x += ingobyiW + gap;
    }
    if (coregroupPath) {
      doc.image(coregroupPath, x, y + 3, { width: coregroupW });
    }

    return y + ingobyiH + 8;
  }

  /** Large hero title — fills the upper certificate area. */
  private drawHeroTitle(
    doc: PdfDoc,
    margin: number,
    contentW: number,
    y: number,
  ): number {
    const pageW = doc.page.width;

    doc.font('Times-Bold').fillColor(COLORS.accent);

    doc.fontSize(44).text('CERTIFICATE', margin, y, {
      width: contentW,
      align: 'center',
      characterSpacing: 5,
    });

    y = doc.y + 2;
    doc.fontSize(34).text('OF COMPLETION', margin, y, {
      width: contentW,
      align: 'center',
      characterSpacing: 4,
    });

    y = doc.y + 16;
    doc
      .moveTo(pageW / 2 - 160, y)
      .lineTo(pageW / 2 + 160, y)
      .lineWidth(1.25)
      .strokeColor(COLORS.border)
      .stroke();

    y += 6;
    doc
      .moveTo(pageW / 2 - 100, y)
      .lineTo(pageW / 2 + 100, y)
      .lineWidth(0.5)
      .strokeColor(COLORS.accent)
      .stroke();

    return y + 14;
  }

  private async render(input: CertificatePdfInput): Promise<Buffer> {
    const qrPng = await QRCode.toBuffer(input.verifyUrl, {
      type: 'png',
      width: 160,
      margin: 0,
      errorCorrectionLevel: 'M',
    });

    const ingobyiLogo = this.resolveAsset('ingobyi.png');
    const coregroupLogo = this.resolveAsset('coregroup.png');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 32, bottom: 32, left: 40, right: 40 },
        autoFirstPage: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const margin = 28;
      const contentW = pageW - margin * 2;

      doc.rect(0, 0, pageW, pageH).fill(COLORS.bg);

      const inset = margin - 4;
      doc
        .lineWidth(2)
        .strokeColor(COLORS.border)
        .rect(inset, inset, pageW - inset * 2, pageH - inset * 2)
        .stroke();

      let y = margin + 12;
      y = this.drawCenteredLogos(doc, pageW, y, ingobyiLogo, coregroupLogo);

      y += 6;
      y = this.drawHeroTitle(doc, margin, contentW, y);

      doc
        .font('Times-Roman')
        .fontSize(12)
        .fillColor(COLORS.muted)
        .text('Presented to', margin, y, { width: contentW, align: 'center' });

      y = doc.y + 16;
      const studentName = input.studentName.toUpperCase();
      doc
        .font('Times-Bold')
        .fontSize(this.fitNameSize(doc, studentName, contentW - 80))
        .fillColor(COLORS.text)
        .text(studentName, margin + 40, y, {
          width: contentW - 80,
          align: 'center',
        });

      y = doc.y + 10;
      doc
        .moveTo(pageW / 2 - 100, y)
        .lineTo(pageW / 2 + 100, y)
        .lineWidth(0.75)
        .strokeColor(COLORS.border)
        .stroke();

      y += 18;
      doc
        .font('Times-Roman')
        .fontSize(12)
        .fillColor(COLORS.muted)
        .text('For completing', margin, y, {
          width: contentW,
          align: 'center',
        });

      y = doc.y + 8;
      doc
        .font('Times-BoldItalic')
        .fontSize(this.fitCourseSize(doc, input.courseTitle, contentW - 80))
        .fillColor(COLORS.green)
        .text(input.courseTitle, margin + 40, y, {
          width: contentW - 80,
          align: 'center',
        });

      y = doc.y + 12;
      const dateStr = input.issuedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc
        .font('Times-Italic')
        .fontSize(11)
        .fillColor(COLORS.muted)
        .text(dateStr, margin, y, { width: contentW, align: 'center' });

      const sigY = pageH - margin - 98;
      const blockW = 168;
      const qrSize = 58;

      this.drawSignatureBlock(
        doc,
        margin + 36,
        sigY,
        input.programLeaderTitle ?? 'Program Leader',
        input.programLeaderName,
        blockW,
        'leader',
      );
      this.drawSignatureBlock(
        doc,
        pageW - margin - 36 - blockW,
        sigY,
        input.ceoTitle ?? 'CEO',
        input.ceoName,
        blockW,
        'ceo',
      );

      const qrX = pageW / 2 - qrSize / 2;
      doc.image(qrPng, qrX, sigY + 2, { width: qrSize, height: qrSize });

      doc
        .font('Times-Bold')
        .fontSize(8)
        .fillColor(COLORS.accent)
        .text('Ingobyi Innovation Hub', margin, pageH - margin - 14, {
          width: contentW,
          align: 'center',
        });

      doc.end();
    });
  }

  private fitNameSize(doc: PdfDoc, name: string, maxWidth: number): number {
    for (let size = 34; size >= 22; size -= 2) {
      doc.fontSize(size);
      if (doc.widthOfString(name) <= maxWidth) return size;
    }
    return 22;
  }

  private fitCourseSize(doc: PdfDoc, title: string, maxWidth: number): number {
    for (let size = 17; size >= 12; size -= 1) {
      doc.fontSize(size);
      if (doc.widthOfString(title) <= maxWidth) return size;
    }
    return 12;
  }

  private drawTestSignature(
    doc: PdfDoc,
    x: number,
    y: number,
    width: number,
    variant: 'leader' | 'ceo',
  ): void {
    doc.save();
    doc
      .lineWidth(1.2)
      .strokeColor(COLORS.ink)
      .lineCap('round')
      .lineJoin('round');

    if (variant === 'leader') {
      doc
        .moveTo(x + 8, y + 20)
        .bezierCurveTo(x + 20, y + 4, x + 36, y + 26, x + 54, y + 14)
        .bezierCurveTo(x + 70, y + 4, x + 88, y + 22, x + width - 8, y + 10)
        .stroke();
    } else {
      doc
        .moveTo(x + 6, y + 16)
        .bezierCurveTo(x + 24, y + 2, x + 42, y + 24, x + 62, y + 10)
        .bezierCurveTo(x + 78, y + 0, x + 96, y + 18, x + width - 6, y + 8)
        .stroke();
    }

    doc.restore();
  }

  private drawSignatureBlock(
    doc: PdfDoc,
    x: number,
    y: number,
    role: string,
    name: string,
    blockW: number,
    signatureVariant: 'leader' | 'ceo',
  ): void {
    this.drawTestSignature(doc, x, y, blockW, signatureVariant);

    doc
      .moveTo(x, y + 32)
      .lineTo(x + blockW, y + 32)
      .lineWidth(0.75)
      .strokeColor(COLORS.border)
      .stroke();

    doc
      .font('Times-Italic')
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(role, x, y + 36, { width: blockW, align: 'center' });

    doc
      .font('Times-Bold')
      .fontSize(8)
      .fillColor(COLORS.text)
      .text(name, x, y + 46, { width: blockW, align: 'center' });
  }
}
