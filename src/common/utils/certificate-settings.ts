export type CertificateSignatorySettings = {
  ceoName: string;
  ceoTitle: string;
  programLeaderName: string;
  programLeaderTitle: string;
  issuerOrgName: string;
};

/** All platform certificates are issued by Ingobyi Innovation Hub. */
export const CERTIFICATE_ISSUER_NAME = 'Ingobyi Innovation Hub';

export const DEFAULT_CERTIFICATE_SIGNATORIES: CertificateSignatorySettings = {
  ceoName: 'Niyomugabo Fidele',
  ceoTitle: 'Coregroup Ltd CEO',
  programLeaderName: 'Cyubahiro Richard',
  programLeaderTitle: 'Ingobyi Innovation Hub Leader',
  issuerOrgName: CERTIFICATE_ISSUER_NAME,
};

export function resolveCertificateSettings(
  orgSettings: unknown,
): CertificateSignatorySettings {
  const root =
    orgSettings && typeof orgSettings === 'object'
      ? (orgSettings as Record<string, unknown>)
      : {};
  const stored =
    root.certificate && typeof root.certificate === 'object'
      ? (root.certificate as Record<string, unknown>)
      : {};

  const pick = (key: keyof CertificateSignatorySettings, fallback: string) => {
    const value = stored[key];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  };

  return {
    ceoName: pick('ceoName', DEFAULT_CERTIFICATE_SIGNATORIES.ceoName),
    ceoTitle: pick('ceoTitle', DEFAULT_CERTIFICATE_SIGNATORIES.ceoTitle),
    programLeaderName: pick(
      'programLeaderName',
      DEFAULT_CERTIFICATE_SIGNATORIES.programLeaderName,
    ),
    programLeaderTitle: pick(
      'programLeaderTitle',
      DEFAULT_CERTIFICATE_SIGNATORIES.programLeaderTitle,
    ),
    issuerOrgName: CERTIFICATE_ISSUER_NAME,
  };
}

export function buildCertificateVerifyUrl(
  frontendUrl: string,
  verifyCode: string,
): string {
  const base = frontendUrl.replace(/\/$/, '');
  return `${base}/verify/certificate/${encodeURIComponent(verifyCode)}`;
}

export function buildCertificateProfileUrl(
  frontendUrl: string,
  userId: string,
  verifyCode: string,
): string {
  const base = frontendUrl.replace(/\/$/, '');
  return `${base}/users/${userId}?tab=achievements&cert=${encodeURIComponent(verifyCode)}`;
}
