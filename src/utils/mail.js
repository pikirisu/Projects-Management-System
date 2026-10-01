import Mailgen from "mailgen";
import nodemailer from "nodemailer";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

// Reserved for documentation and testing (RFC 2606, RFC 6761): nothing sent to
// them can arrive. The demo accounts and the e2e suite's users live here.
const RESERVED_TLDS = new Set([
    "test",
    "example",
    "invalid",
    "local",
    "localhost",
]);
const RESERVED_DOMAINS = ["example.com", "example.net", "example.org"];

export function isDeliverable(address) {
    const domain = String(address).split("@").pop().toLowerCase();
    return (
        !RESERVED_TLDS.has(domain.split(".").pop()) &&
        !RESERVED_DOMAINS.some(
            (reserved) =>
                domain === reserved || domain.endsWith(`.${reserved}`),
        )
    );
}

let transporter;

// Created on first use rather than at import, so it reads the loaded env.
function smtp() {
    transporter ??= nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return transporter;
}

// Decision: production sends through Brevo's HTTPS API, not SMTP. Render's free
// tier blocks outbound SMTP (ports 25, 465 and 587), while a request on 443 is
// ordinary traffic. Without an API key, development keeps SMTP (Mailtrap).
async function deliver({ from, to, subject, text, html }) {
    if (!process.env.BREVO_API_KEY) {
        await smtp().sendMail({ from, to, subject, text, html });
        return;
    }

    const response = await fetch(BREVO_URL, {
        method: "POST",
        headers: {
            "api-key": process.env.BREVO_API_KEY,
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            sender: { name: "Project Camp", email: from },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text,
        }),
    });
    if (!response.ok) {
        throw new Error(
            `Brevo answered ${response.status}: ${await response.text()}`,
        );
    }
}

/**
 * Sends one email. Failures are logged and never thrown, so a caller can fire
 * this without awaiting it.
 */
export async function sendEmail({ to, subject, content }) {
    // A reserved address only bounces, which costs quota and sender reputation.
    if (!isDeliverable(to)) return;

    try {
        const mailGenerator = new Mailgen({
            theme: "default",
            product: {
                name: "Project Camp",
                link: process.env.APP_URL || "http://localhost:5173",
            },
        });

        await deliver({
            from: process.env.MAIL_FROM || "no-reply@projectcamp.dev",
            to,
            subject,
            text: mailGenerator.generatePlaintext(content),
            html: mailGenerator.generate(content),
        });
    } catch (error) {
        console.error(`[mail] could not send "${subject}":`, error.message);
    }
}

const actionEmail = ({ name, intro, instructions, buttonText, link }) => ({
    body: {
        name,
        intro,
        action: {
            instructions,
            button: { color: "#4f46e5", text: buttonText, link },
        },
        outro: "If you did not expect this email, you can safely ignore it.",
    },
});

export const verificationEmail = (name, link) =>
    actionEmail({
        name,
        intro: "Welcome to Project Camp!",
        instructions: "Confirm your email address to finish setting up.",
        buttonText: "Verify email",
        link,
    });

export const passwordResetEmail = (name, link) =>
    actionEmail({
        name,
        intro: "We received a request to reset your password.",
        instructions: "This link works once and expires in 20 minutes.",
        buttonText: "Reset password",
        link,
    });
