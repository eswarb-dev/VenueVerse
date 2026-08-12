import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import QRCode from 'https://esm.sh/qrcode@1.5.4';
import {
  APPROVED_STAMP_PNG_BASE64,
  REJECTED_STAMP_PNG_BASE64,
  SREC_HEADER_PNG_BASE64,
  VENUEVERSE_LOGO_PNG_BASE64
} from '../generate-booking-receipt/receiptAssets.ts';

export type ReceiptStatus = 'approved' | 'rejected';

export type ReceiptBuildResult = {
  pdfBuffer: Uint8Array;
  receiptNumber: string;
  bookingId: string;
  status: ReceiptStatus;
  storagePath?: string;
};

type BookingRow = {
  id: string;
  user_id: string | null;
  event_title: string;
  event_type: string | null;
  department: string | null;
  faculty_coordinator: string | null;
  start_time: string;
  end_time: string;
  status: ReceiptStatus | string;
  admin_remarks: string | null;
  approved_by: string | null;
  updated_at: string | null;
  halls: {
    name: string | null;
    department: string | null;
    venue_type: string | null;
    location: string | null;
    block: string | null;
    floor: string | null;
  } | { name: string | null; department: string | null; venue_type: string | null; location: string | null; block: string | null; floor: string | null }[] | null;
  requester: {
    full_name: string | null;
    email: string | null;
    department: string | null;
    role: string | null;
  } | { full_name: string | null; email: string | null; department: string | null; role: string | null }[] | null;
  approver: {
    full_name: string | null;
    email: string | null;
  } | { full_name: string | null; email: string | null }[] | null;
};

type ReceiptRow = {
  booking_id: string;
  receipt_no: string;
  verification_token: string;
  status: ReceiptStatus;
  pdf_path: string;
  qr_payload: string;
  generated_at: string;
};

export async function buildReceiptPdf(
  supabase: ReturnType<typeof createClient>,
  bookingId: string
): Promise<ReceiptBuildResult> {
  const booking = await fetchBooking(supabase, bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (booking.status !== 'approved' && booking.status !== 'rejected') {
    throw new Error('Receipts are generated only for approved or rejected bookings.');
  }

  const receipt = await fetchReceipt(supabase, bookingId);
  if (!receipt) throw new Error('Receipt metadata not found.');

  const year = new Date(booking.updated_at ?? booking.start_time).getFullYear();
  const pdfBuffer = await renderReceiptPdf({
    booking,
    bookingRef: formatBookingRef(booking.id, year),
    receiptNo: receipt.receipt_no,
    qrPayload: receipt.qr_payload || `venueverse://receipt/verify/${receipt.verification_token}`,
    generatedAt: new Date(receipt.generated_at)
  });

  return {
    pdfBuffer,
    receiptNumber: receipt.receipt_no,
    bookingId: booking.id,
    status: booking.status,
    storagePath: receipt.pdf_path
  };
}

async function fetchBooking(supabase: ReturnType<typeof createClient>, bookingId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, event_title, event_type, department, faculty_coordinator, start_time, end_time, status, admin_remarks, approved_by, updated_at, halls(name, department, venue_type, location, block, floor), requester:user_id(full_name, email, department, role), approver:approved_by(full_name, email)')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data as BookingRow | null;
}

async function fetchReceipt(supabase: ReturnType<typeof createClient>, bookingId: string) {
  const { data, error } = await supabase
    .from('booking_receipts')
    .select('booking_id, receipt_no, verification_token, status, pdf_path, qr_payload, generated_at')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data as ReceiptRow | null;
}

async function renderReceiptPdf(params: {
  booking: BookingRow;
  bookingRef: string;
  receiptNo: string;
  qrPayload: string;
  generatedAt: Date;
}) {
  const { booking, bookingRef, receiptNo, qrPayload, generatedAt } = params;
  const status = booking.status as ReceiptStatus;
  const isApproved = status === 'approved';
  const hall = single(booking.halls);
  const requester = single(booking.requester);
  const approver = single(booking.approver);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const headerImage = await pdfDoc.embedPng(decodeBase64(SREC_HEADER_PNG_BASE64));
  const logoImage = await pdfDoc.embedPng(decodeBase64(VENUEVERSE_LOGO_PNG_BASE64));
  const stampImage = await pdfDoc.embedPng(decodeBase64(isApproved ? APPROVED_STAMP_PNG_BASE64 : REJECTED_STAMP_PNG_BASE64));

  const primary = rgb(0.039, 0.227, 0.4);
  const green = rgb(0.084, 0.451, 0.278);
  const red = rgb(0.706, 0.137, 0.094);
  const muted = rgb(0.4, 0.44, 0.52);
  const border = rgb(0.85, 0.88, 0.91);
  const light = rgb(0.965, 0.98, 0.99);
  const statusColor = isApproved ? green : red;

  page.drawImage(headerImage, { x: 34, y: 766, width: 527, height: 54 });
  page.drawLine({ start: { x: 34, y: 754 }, end: { x: 561, y: 754 }, thickness: 2, color: green });
  page.drawImage(logoImage, { x: 42, y: 696, width: 46, height: 46 });
  page.drawText('Official Venue Booking Receipt', { x: 100, y: 728, size: 20, font: bold, color: primary });
  page.drawText(isApproved ? 'Approved venue / hall booking proof document' : 'Rejected venue / hall booking decision document', {
    x: 100,
    y: 709,
    size: 10,
    font: regular,
    color: muted
  });
  page.drawImage(stampImage, { x: 435, y: 690, width: 92, height: 58 });

  drawBox(page, 34, 620, 527, 58, light, border);
  drawMeta(page, bold, regular, 'Receipt No', receiptNo, 48, 654, primary, muted);
  drawMeta(page, bold, regular, 'Booking ID', bookingRef, 190, 654, primary, muted);
  drawMeta(page, bold, regular, 'Generated On', formatDateTime(generatedAt.toISOString()), 322, 654, primary, muted);
  drawQrCode(page, qrPayload, 492, 626, 50);
  page.drawText('Verify', { x: 507, y: 621, size: 6.5, font: bold, color: primary });

  const bookingRows = [
    ['Session / Event Name', booking.event_title],
    ['Booked Venue', hall?.name ?? 'Venue not provided'],
    ['Department', booking.department ?? requester?.department ?? 'Not provided'],
    ['Venue Type', hall?.venue_type ?? booking.event_type ?? 'Not provided'],
    ['Location', formatLocation(hall)],
    ['Date', formatDate(booking.start_time)],
    ['Time Slot', `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`],
    ['Booking Status', status.toUpperCase()]
  ];

  const requesterRows = [
    ['Requested By', requester?.full_name ?? 'Not provided'],
    ['Requester Email', requester?.email ?? 'Not provided'],
    ['Requester Dept.', requester?.department ?? 'Not provided'],
    ['Requester Role', requester?.role ?? 'user'],
    ['Faculty Coordinator', booking.faculty_coordinator ?? 'Not provided']
  ];

  const decisionRows = [
    [isApproved ? 'Approved Status' : 'Decision Status', isApproved ? 'Approved' : 'Rejected'],
    [isApproved ? 'Approved By' : 'Rejected By', approver?.full_name ?? 'Not provided'],
    [isApproved ? 'Approved On' : 'Rejected On', booking.updated_at ? formatDateTime(booking.updated_at) : 'Not provided'],
    [isApproved ? 'Approval Remarks' : 'Rejection Remarks', booking.admin_remarks || 'No remarks provided.']
  ];

  const leftBottom = drawCompactSection(page, bold, regular, 'Booking Summary', bookingRows, 34, 590, 305, primary, statusColor);
  let rightBottom = drawCompactSection(page, bold, regular, 'Requester Details', requesterRows, 351, 590, 210, primary, primary);
  rightBottom = drawCompactSection(page, bold, regular, isApproved ? 'Approval Details' : 'Decision Details', decisionRows, 351, rightBottom - 9, 210, primary, statusColor);
  let y = Math.min(leftBottom, rightBottom) - 10;

  const purpose = isApproved
    ? 'This document confirms that the listed venue booking has been approved for the specified date and time slot. It may be shown to the venue coordinator, department staff, or admin when accessing the hall, lab, or auditorium.'
    : 'This document confirms that the listed venue booking request was reviewed and rejected. It is provided as an official decision record for the requester and department reference.';
  const purposeHeight = estimateTextHeight(regular, purpose, 497, 8.5, 11.5) + 34;
  drawDocumentPurpose(page, bold, regular, purpose, 34, y, 527, purposeHeight, isApproved, primary, muted, border);
  y -= purposeHeight + 8;
  drawFooter(page, bold, regular, primary, muted, Math.max(y, 82));

  return await pdfDoc.save();
}

function drawCompactSection(page: ReturnType<PDFDocument['addPage']>, bold: unknown, regular: unknown, title: string, rows: string[][], x: number, topY: number, width: number, primary: ReturnType<typeof rgb>, accent: ReturnType<typeof rgb>) {
  const height = estimateCompactSectionHeight(rows, regular, width);
  drawBox(page, x, topY - height, width, height, rgb(1, 1, 1), rgb(0.85, 0.88, 0.91));
  page.drawRectangle({ x, y: topY - 20, width, height: 20, color: rgb(0.965, 0.98, 0.99) });
  page.drawText(title, { x: x + 10, y: topY - 14, size: 9.5, font: bold, color: primary });
  page.drawRectangle({ x, y: topY - height, width: 4, height, color: accent, opacity: 0.92 });
  return drawCompactTable(page, bold, regular, rows, x + 10, topY - 31, width - 20, accent) - 10;
}

function drawCompactTable(page: ReturnType<PDFDocument['addPage']>, bold: unknown, regular: unknown, rows: string[][], x: number, y: number, width: number, accent: ReturnType<typeof rgb>) {
  let currentY = y;
  const labelWidth = Math.min(100, width * 0.42);
  rows.forEach(([label, value]) => {
    const rowHeight = getCompactRowHeight(regular, value, width - labelWidth - 8);
    page.drawText(label, { x, y: currentY, size: 7.5, font: bold, color: rgb(0.4, 0.44, 0.52) });
    const color = label.includes('Status') ? accent : rgb(0.09, 0.13, 0.17);
    drawWrappedText(page, label.includes('Status') ? bold : regular, value, x + labelWidth, currentY, width - labelWidth - 8, 8, 10, color);
    currentY -= rowHeight;
  });
  return currentY;
}

function drawQrCode(page: ReturnType<PDFDocument['addPage']>, payload: string, x: number, y: number, size: number) {
  const qr = QRCode.create(payload, { margin: 1 });
  const modules = qr.modules as { size: number; data: boolean[] };
  const moduleCount = modules.size;
  const cellSize = size / moduleCount;

  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) });
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!modules.data[row * moduleCount + col]) continue;
      page.drawRectangle({
        x: x + col * cellSize,
        y: y + size - (row + 1) * cellSize,
        width: cellSize + 0.05,
        height: cellSize + 0.05,
        color: rgb(0, 0, 0)
      });
    }
  }
}

function drawMeta(page: ReturnType<PDFDocument['addPage']>, bold: unknown, regular: unknown, label: string, value: string, x: number, y: number, textColor: ReturnType<typeof rgb>, muted: ReturnType<typeof rgb>) {
  page.drawText(label, { x, y, size: 7.5, font: bold, color: muted });
  page.drawText(toPdfText(value), { x, y: y - 14, size: 9, font: regular, color: textColor });
}

function drawBox(page: ReturnType<PDFDocument['addPage']>, x: number, y: number, width: number, height: number, color: ReturnType<typeof rgb>, borderColor: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width, height, color, borderColor, borderWidth: 1 });
}

function drawWrappedText(page: ReturnType<PDFDocument['addPage']>, font: unknown, text: string, x: number, y: number, maxWidth: number, size: number, lineHeight: number, color: ReturnType<typeof rgb>) {
  const lines = wrapTextLines(font, text, maxWidth, size);
  lines.forEach((line, index) => {
    page.drawText(toPdfText(line), { x, y: y - index * lineHeight, size, font, color });
  });
}

function drawFooter(page: ReturnType<PDFDocument['addPage']>, bold: unknown, regular: unknown, primary: ReturnType<typeof rgb>, muted: ReturnType<typeof rgb>, y: number) {
  page.drawLine({ start: { x: 34, y: y + 18 }, end: { x: 561, y: y + 18 }, thickness: 1, color: rgb(0.85, 0.88, 0.91) });
  page.drawText('VenueVerse', { x: 34, y, size: 10, font: bold, color: primary });
  page.drawText('Generated electronically by the Campus Venue Booking System.', { x: 34, y: y - 13, size: 8, font: regular, color: muted });
  page.drawText('This receipt is valid only with its verification QR code.', { x: 34, y: y - 25, size: 8, font: regular, color: muted });
}

function drawDocumentPurpose(page: ReturnType<PDFDocument['addPage']>, bold: unknown, regular: unknown, purpose: string, x: number, y: number, width: number, height: number, approved: boolean, primary: ReturnType<typeof rgb>, muted: ReturnType<typeof rgb>, border: ReturnType<typeof rgb>) {
  drawBox(page, x, y - height, width, height, approved ? rgb(0.952, 0.986, 0.965) : rgb(0.996, 0.95, 0.95), border);
  page.drawText('Document Purpose', { x: x + 12, y: y - 16, size: 9.5, font: bold, color: primary });
  drawWrappedText(page, regular, purpose, x + 12, y - 32, width - 24, 8.5, 11.5, muted);
}

function estimateCompactSectionHeight(rows: string[][], font: unknown, width: number) {
  return rows.reduce((total, [, value]) => total + getCompactRowHeight(font, value, width - Math.min(100, width * 0.42) - 8), 30);
}

function getCompactRowHeight(font: unknown, value: string, width: number) {
  return Math.max(18, estimateTextHeight(font, value, width, 8, 10) + 4);
}

function estimateTextHeight(font: unknown, text: string, maxWidth: number, size: number, lineHeight: number) {
  return wrapTextLines(font, text, maxWidth, size).length * lineHeight;
}

function wrapTextLines(font: unknown, text: string, maxWidth: number, size: number) {
  const words = toPdfText(text).split(/\s+/);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    const width = (font as { widthOfTextAtSize: (value: string, fontSize: number) => number }).widthOfTextAtSize(candidate, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function formatBookingRef(bookingId: string, year: number) {
  return `VV-${year}-${bookingId.slice(0, 8).toUpperCase()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function formatLocation(hall: ReturnType<typeof single<NonNullable<BookingRow['halls']>>>) {
  const parts = [hall?.location, hall?.block, hall?.floor].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Not provided';
}

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toPdfText(value: string) {
  return String(value)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, (char) => {
      const replacements: Record<string, string> = {
        '•': '-',
        '–': '-',
        '—': '-',
        '’': "'"
      };
      return replacements[char] ?? '';
    });
}
