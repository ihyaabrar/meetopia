/** Pengiriman email. Tanpa SMTP_URL, isi email dicetak ke konsol (pengembangan). */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  const url = process.env.SMTP_URL;
  if (!url) {
    console.log(`\n[mail] Ke: ${mail.to}\n[mail] Subjek: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport(url);
  await transport.sendMail({ from: process.env.MAIL_FROM ?? "Meetopia <no-reply@example.com>", ...mail });
}
