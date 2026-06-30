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

const transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST,
    port: Number(process.env.MAILTRAP_PORT),
    auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
    },
});

const generateMail = (emailBody, subject) => ({
    subject,
    emailBody,
});

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

    if (action) body.action = action;

    return generateMail({ body }, `Welcome to ${appName}`);
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

    return generateMail({ body }, `Reset your ${appName} password`);
};

const generateEmailVerificationMail = ({
    name = "User",
    verificationToken,
} = {}) => {
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;

    const action = buildAction(
        "Click the button below to verify your email address:",
        "Verify Email",
        verificationUrl,
    );

    const body = {
        name,
        intro: [
            `Welcome to ${appName}.`,
            "Please verify your email address to activate your account.",
        ],
        outro: [
            "If you did not create this account, you can safely ignore this email.",
        ],
    };

    if (action) body.action = action;

    return generateMail({ body }, "Please Verify Your Email");
};

const sendMail = async ({ email, subject, emailBody }) => {
    try {
        return await transporter.sendMail({
            from: process.env.MAILTRAP_SENDEREMAIL || supportEmail,
            to: email,
            subject,
            text: mailGenerator.generatePlaintext(emailBody),
            html: mailGenerator.generate(emailBody),
        });
    } catch (error) {
        console.error("Mail error:", error);
        throw error;
    }
};

export {
    generateWelcomeUserMail,
    generateForgotPasswordMail,
    generateEmailVerificationMail,
    sendMail,
};
