import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import type { Env } from "../config/env.validation";
import { UsersService } from "../users/users.service";

export interface EmailPayload {
  userId: string;
  subject: string;
  body: string;
}

function renderHtml(subject: string, body: string): string {
  return `<!doctype html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">` +
    `<h2 style="color:#111">${subject}</h2><p style="color:#333;line-height:1.6">${body}</p>` +
    `<hr style="border:none;border-top:1px solid #eee;margin-top:24px">` +
    `<p style="color:#999;font-size:12px">Tradeloop notification</p></body></html>`;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(
    private readonly users: UsersService,
    config: ConfigService<Env, true>,
  ) {
    this.from = config.get("EMAIL_FROM", { infer: true });
    this.transporter = createTransport({
      host: config.get("BREVO_SMTP_HOST", { infer: true }),
      port: config.get("BREVO_SMTP_PORT", { infer: true }),
      secure: false,
      auth: {
        user: config.get("BREVO_SMTP_USER", { infer: true }),
        pass: config.get("BREVO_SMTP_KEY", { infer: true }),
      },
    });
  }

  async send(payload: EmailPayload): Promise<void> {
    const user = await this.users.findById(payload.userId);
    if (!user) {
      this.logger.warn(`Skipping email for unknown user ${payload.userId}`);
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: user.email,
      subject: payload.subject,
      text: payload.body,
      html: renderHtml(payload.subject, payload.body),
    });
  }
}
