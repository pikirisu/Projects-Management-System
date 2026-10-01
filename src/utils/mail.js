import Mailgen from "mailgen";
import nodemailer from "nodemailer";

let transporter;

// Created on first use rather than at import, so it reads the loaded env.
function getTransporter() {
    transporter ??= nodemailer.createTransport({
        host: process.env.MAILTRAP_SMTP_HOST,
        port: Number(process.env.MAILTRAP_SMTP_PORT),
        auth: {
            user: process.env.MAILTRAP_SMTP_USER,
            pass: process.env.MAILTRAP_SMTP_PASS,
        },
    });
    return transporter;
}

/**
 * Sends one email. Failures are logged and never thrown, so a caller can fire
 * this without awaiting it.
 */
export async function sendEmail({ to, subject, content }) {
    try {
        const mailGenerator = new Mailgen({
            theme: "default",
            product: {
                name: "Project Camp",
                link: process.env.APP_URL || "http://localhost:5173",
            },
        });

        await getTransporter().sendMail({
            from:
                process.env.MAILTRAP_SENDEREMAIL || "no-reply@projectcamp.dev",
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
