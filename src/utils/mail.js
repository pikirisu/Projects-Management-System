import Mailgen from "mailgen";
import nodemailer from "nodemailer";

const appName = process.env.APP_NAME || "Backend One";
const appUrl = process.env.APP_URL || "http://localhost:3000";
const supportEmail = process.env.SUPPORT_EMAIL || "support@example.com";

const mailGenerator = new Mailgen({
    theme: "cerberus",
    product: {
        name: appName,
        link: appUrl,
    },
});

const generateMail = (emailBody, subject) => {
    return {
        subject,
        html: mailGenerator.generate(emailBody),
        text: mailGenerator.generatePlaintext(emailBody),
    };
};

const buildAction = (instructions, buttonText, buttonLink) => {
    if (!buttonLink) return undefined;

    return {
        instructions,
        button: {
            color: "#2563eb",
            text: buttonText,
            link: buttonLink,
        },
    };
};

const generateWelcomeUserMail = ({ name = "User", loginUrl = appUrl } = {}) => {
    const action = buildAction(
        "You can start using your account here",
        "Log In",
        loginUrl,
    );

    const body = {
        name,
        intro: [
            `Welcome to ${appName}.`,
            "Your account has been created successfully.",
        ],
        outro: `Need Help? Reach us at ${supportEmail}`,
    };

    if (action) {
        body.action = action;
    }

    const emailBody = { body };

    return generateMail(emailBody, `Welcome to ${appName}`);
};

const generateForgotPasswordMail = ({ name = "User", resetUrl } = {}) => {
    const action = buildAction(
        "Click the button below to set a new password:",
        "Reset Password",
        resetUrl,
    );

    const body = {
        name,
        intro: ["We received a request to reset your password."],
        outro: [
            "If you did not request this, you can safely ignore this email.",
            `For support, contact ${supportEmail}.`,
        ],
    };

    if (action) body.action = action;

    const emailBody = { body };

    return generateMail(emailBody, `Reset your ${appName} password`);
};

const sendMail = async ({ email, subject, emailBody }) => {
    try {
        const emailText = mailGenerator.generatePlaintext(emailBody);
        const emailHtml = mailGenerator.generate(emailBody);

        const transporter = nodemailer.createTransport({
            host: process.env.MAILTRAP_HOST,
            port: Number(process.env.MAILTRAP_PORT),
            auth: {
                user: process.env.MAILTRAP_USER,
                pass: process.env.MAILTRAP_PASS,
            },
        });

        const mail = {
            from: process.env.MAILTRAP_SENDEREMAIL || supportEmail,
            to: email,
            subject,
            text: emailText,
            html: emailHtml,
        };

        return await transporter.sendMail(mail);
    } catch (error) {
        console.error("Mail error:", error);
        throw error;
    }
};

export { generateWelcomeUserMail, generateForgotPasswordMail, sendMail };
